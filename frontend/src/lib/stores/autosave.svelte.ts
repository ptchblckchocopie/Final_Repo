import type { TicketElement, TicketSettings, LabelConfig, BackgroundFitMode } from '$lib/types/ticket';
import { getElements, setElements } from './elements.svelte';
import { getCsvData, getCsvHeaders, setCsvDirect } from './csv.svelte';
import { getTicketSettings, setAllSettings } from './ticket-settings.svelte';
import { getLabelConfig, setAllLabelConfig } from './labels.svelte';
import { getBackgroundImage, getBackgroundFitMode, setBackgroundImage, setBackgroundFitMode } from './canvas.svelte';
import { getTicketGap, setTicketGap } from './print-settings.svelte';
import { markClean } from './dirty.svelte';
import { clearHistory } from './history.svelte';

const DB_NAME = 'veenttix-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'session';
const DEBOUNCE_MS = 2000;

let hasPendingSession = $state(false);
let pendingSessionTime = $state<string | null>(null);

// --- IndexedDB helpers ---

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'key' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function dbPut(key: string, value: unknown): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put({ key, value });
		tx.oncomplete = () => { db.close(); resolve(); };
		tx.onerror = () => { db.close(); reject(tx.error); };
	});
}

async function dbGet<T>(key: string): Promise<T | undefined> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const req = tx.objectStore(STORE_NAME).get(key);
		req.onsuccess = () => { db.close(); resolve(req.result?.value as T | undefined); };
		req.onerror = () => { db.close(); reject(req.error); };
	});
}

async function dbClear(): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).clear();
		tx.oncomplete = () => { db.close(); resolve(); };
		tx.onerror = () => { db.close(); reject(tx.error); };
	});
}

// --- Conversion helpers ---

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
	const res = await fetch(dataUrl);
	return res.blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

// --- Public API ---

export function getHasPendingSession() {
	return hasPendingSession;
}

export function getPendingSessionTime() {
	return pendingSessionTime;
}

export async function checkForPendingSession(): Promise<boolean> {
	try {
		const savedAt = await dbGet<string>('savedAt');
		if (savedAt) {
			hasPendingSession = true;
			pendingSessionTime = savedAt;
			return true;
		}
	} catch (err) {
		console.error('Failed to check IndexedDB for pending session:', err);
	}
	hasPendingSession = false;
	pendingSessionTime = null;
	return false;
}

export async function restoreSession(): Promise<void> {
	try {
		// BUG-M4: Clear stale history before restoring to prevent undo to wrong state
		clearHistory();

		// BUG-C2: Use Promise.allSettled so a single corrupt key doesn't block all recovery
		const results = await Promise.allSettled([
			dbGet<TicketElement[]>('elements'),
			dbGet<Record<string, string>[]>('csvData'),
			dbGet<string[]>('csvHeaders'),
			dbGet<TicketSettings>('ticketSettings'),
			dbGet<LabelConfig>('labelConfig'),
			dbGet<BackgroundFitMode>('backgroundFitMode'),
			dbGet<Blob>('backgroundImage'),
			dbGet<number>('ticketGap')
		]);

		const settled = <T>(r: PromiseSettledResult<T | undefined>): T | undefined =>
			r.status === 'fulfilled' ? r.value : undefined;

		const elements = settled(results[0]);
		const csvData = settled(results[1]);
		const csvHeaders = settled(results[2]);
		const ticketSettings = settled(results[3]);
		const labelConfig = settled(results[4]);
		const backgroundFitMode = settled(results[5]);
		const backgroundImageBlob = settled(results[6]);
		const ticketGap = settled(results[7]);

		if (elements) setElements(elements);
		if (csvData && csvHeaders) setCsvDirect(csvData, csvHeaders);
		if (ticketSettings) setAllSettings(ticketSettings);
		if (labelConfig) setAllLabelConfig(labelConfig);
		if (backgroundFitMode) setBackgroundFitMode(backgroundFitMode);

		if (backgroundImageBlob && backgroundImageBlob instanceof Blob) {
			const dataUrl = await blobToDataUrl(backgroundImageBlob);
			setBackgroundImage(dataUrl);
		}

		if (ticketGap !== undefined) {
			setTicketGap(ticketGap);
		}

		markClean();
	} catch (err) {
		console.error('Failed to restore session from IndexedDB:', err);
	}

	hasPendingSession = false;
	pendingSessionTime = null;
}

export async function discardSession(): Promise<void> {
	await dbClear();
	hasPendingSession = false;
	pendingSessionTime = null;
}

export async function clearAutosave(): Promise<void> {
	await dbClear();
	hasPendingSession = false;
	pendingSessionTime = null;
}

// BUG-C1: Track cleanup function to prevent effect accumulation
let autoSaveCleanup: (() => void) | null = null;

export function initAutoSave(): void {
	// BUG-C1: Clean up previous effect before creating a new one
	if (autoSaveCleanup) {
		autoSaveCleanup();
		autoSaveCleanup = null;
	}

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	autoSaveCleanup = $effect.root(() => {
	$effect(() => {
		// Read all store values to establish reactive dependencies
		const elements = getElements();
		const csvData = getCsvData();
		const csvHeaders = getCsvHeaders();
		const ticketSettings = getTicketSettings();
		const labelConfig = getLabelConfig();
		const backgroundFitMode = getBackgroundFitMode();
		const backgroundImage = getBackgroundImage();
		const ticketGap = getTicketGap();

		// Deep-clone reactive state to strip Svelte 5 proxies (required for IndexedDB structured clone)
		const snapshot = {
			elements: JSON.parse(JSON.stringify(elements)),
			csvData: JSON.parse(JSON.stringify(csvData)),
			csvHeaders: JSON.parse(JSON.stringify(csvHeaders)),
			ticketSettings: JSON.parse(JSON.stringify(ticketSettings)),
			labelConfig: JSON.parse(JSON.stringify(labelConfig)),
			backgroundFitMode,
			backgroundImage,
			ticketGap
		};

		if (debounceTimer) clearTimeout(debounceTimer);

		debounceTimer = setTimeout(async () => {
			try {
				const writes: Promise<void>[] = [
					dbPut('elements', snapshot.elements),
					dbPut('csvData', snapshot.csvData),
					dbPut('csvHeaders', snapshot.csvHeaders),
					dbPut('ticketSettings', snapshot.ticketSettings),
					dbPut('labelConfig', snapshot.labelConfig),
					dbPut('backgroundFitMode', snapshot.backgroundFitMode),
					dbPut('ticketGap', snapshot.ticketGap),
					dbPut('savedAt', new Date().toISOString())
				];

				if (snapshot.backgroundImage) {
					const blob = await dataUrlToBlob(snapshot.backgroundImage);
					writes.push(dbPut('backgroundImage', blob));
				} else {
					writes.push(dbPut('backgroundImage', null));
				}

				await Promise.all(writes);
			} catch (err) {
				console.error('Auto-save to IndexedDB failed:', err);
			}
		}, DEBOUNCE_MS);
	});
	});
}
