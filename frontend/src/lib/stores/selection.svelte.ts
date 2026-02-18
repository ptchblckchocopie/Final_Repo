import type { TicketElement } from '$lib/types/ticket';
import { getElements, getElementById } from './elements.svelte';

let selectedIds = $state(new Set<string>());
let clipboard = $state<TicketElement[]>([]);

export function getSelectedIds() {
	return selectedIds;
}

export function isSelected(id: string) {
	return selectedIds.has(id);
}

export function select(id: string) {
	selectedIds = new Set([id]);
}

export function toggleSelect(id: string) {
	const next = new Set(selectedIds);
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	selectedIds = next;
}

export function clearSelection() {
	selectedIds = new Set();
}

export function selectAll() {
	selectedIds = new Set(getElements().map((e) => e.id));
}

export function getActiveElement(): TicketElement | undefined {
	if (selectedIds.size === 1) {
		const [id] = selectedIds;
		return getElementById(id);
	}
	return undefined;
}

export function copySelected() {
	const elements = getElements();
	clipboard = JSON.parse(
		JSON.stringify(elements.filter((e) => selectedIds.has(e.id)))
	);
}

export function cutSelected() {
	copySelected();
	return new Set(selectedIds);
}

export function getClipboard(): TicketElement[] {
	return clipboard.map((el) => ({
		...JSON.parse(JSON.stringify(el)),
		id: crypto.randomUUID(),
		position: {
			x: el.position.x + 15,
			y: el.position.y + 15
		}
	}));
}

export function hasClipboard() {
	return clipboard.length > 0;
}

// BUG-M3: Allow external clearing of clipboard (e.g., on template load)
export function clearClipboard() {
	clipboard = [];
}
