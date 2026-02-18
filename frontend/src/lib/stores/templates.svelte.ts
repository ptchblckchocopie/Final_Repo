import type { TicketTemplate, TicketSettings, TicketElement, LabelConfig } from '$lib/types/ticket';
import type { PayloadTicketTemplate } from '$lib/types/payload';
import {
	getTemplates,
	createTemplate,
	updateTemplate,
	deleteTemplateById,
	uploadBackgroundImage
} from '$lib/api/templates';

const BUILT_IN_TEMPLATES: TicketTemplate[] = [
	{
		id: 'blank-ticket',
		name: 'Blank Ticket',
		builtIn: true,
		backgroundImage: null,
		ticketSettings: { type: 'ticket', width: 226.32258, height: 80, fitMode: 'cover' },
		elements: [],
		labelBlock: null
	},
	{
		id: 'blank-convention-id',
		name: 'Blank Convention ID',
		builtIn: true,
		backgroundImage: null,
		ticketSettings: { type: 'convention-id', width: 101.6, height: 152.4, fitMode: 'cover' },
		elements: [],
		labelBlock: null
	},
	{
		id: 'blank-certificate',
		name: 'Blank Certificate',
		builtIn: true,
		backgroundImage: null,
		ticketSettings: { type: 'certificate', width: 297, height: 210, fitMode: 'cover' },
		elements: [],
		labelBlock: null
	}
];

let userTemplates = $state<PayloadTicketTemplate[]>([]);
let isLoading = $state(false);
let hasFetched = $state(false);

export function getBuiltInTemplates(): TicketTemplate[] {
	return BUILT_IN_TEMPLATES;
}

export function getUserTemplates(): PayloadTicketTemplate[] {
	return userTemplates;
}

export function getIsLoading() {
	return isLoading;
}

export function getHasFetched() {
	return hasFetched;
}

export function getBuiltInTemplate(id: string): TicketTemplate | undefined {
	return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

export async function fetchUserTemplates(): Promise<void> {
	if (isLoading) return;
	isLoading = true;
	try {
		const response = await getTemplates({ limit: 100, sort: 'name' });
		userTemplates = response.docs;
		hasFetched = true;
	} catch (err) {
		console.error('Failed to fetch templates:', err);
		// BUG-M5: Don't set hasFetched on error — allow retry on next call
	} finally {
		isLoading = false;
	}
}

function dataUrlToFile(dataUrl: string, filename: string): File {
	// BUG-M6: Validate data URL format before parsing
	if (!dataUrl.startsWith('data:') || !dataUrl.includes(',')) {
		throw new Error('Invalid background image data URL format');
	}
	const commaIndex = dataUrl.indexOf(',');
	const header = dataUrl.slice(0, commaIndex);
	const base64 = dataUrl.slice(commaIndex + 1);
	const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
	const bytes = atob(base64);
	const arr = new Uint8Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) {
		arr[i] = bytes.charCodeAt(i);
	}
	return new File([arr], filename, { type: mime });
}

export async function saveTemplateToBackend(
	name: string,
	backgroundImageDataUrl: string | null,
	ticketSettings: TicketSettings,
	elements: TicketElement[],
	labelConfig: LabelConfig,
	csvData: Record<string, string>[],
	csvHeaders: string[],
	printSettings?: { ticketGap: number } | null
): Promise<{ template: PayloadTicketTemplate; wasOverwrite: boolean }> {
	let backgroundImageId: number | null = null;

	if (backgroundImageDataUrl) {
		const file = dataUrlToFile(backgroundImageDataUrl, `template-bg-${Date.now()}.png`);
		const media = await uploadBackgroundImage(file);
		backgroundImageId = media.id;
	}

	const payload = {
		name,
		backgroundImage: backgroundImageId,
		ticketSettings,
		elements: JSON.parse(JSON.stringify(elements)),
		labelConfig,
		csvData: csvData.length > 0 ? csvData : null,
		csvHeaders: csvHeaders.length > 0 ? csvHeaders : null,
		printSettings: printSettings ?? null
	};

	// Check if a template with this name already exists (case-insensitive)
	const existing = userTemplates.find(
		(t) => t.name.toLowerCase() === name.toLowerCase()
	);

	if (existing) {
		const template = await updateTemplate(existing.id, payload);
		// Refetch to get fully populated relationships (e.g. backgroundImage as object, not just ID)
		const refreshed = await getTemplates({ limit: 100, sort: 'name' });
		userTemplates = refreshed.docs;
		return { template, wasOverwrite: true };
	}

	const template = await createTemplate(payload);
	// Refetch to get fully populated relationships
	const refreshed = await getTemplates({ limit: 100, sort: 'name' });
	userTemplates = refreshed.docs;
	return { template, wasOverwrite: false };
}

export async function deleteTemplateFromBackend(id: number): Promise<void> {
	await deleteTemplateById(id);
	userTemplates = userTemplates.filter((t) => t.id !== id);
}
