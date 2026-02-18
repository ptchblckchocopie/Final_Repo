let isDirty = $state(false);
let lastSavedTime = $state<string | null>(null);
let lastSavedTemplateName = $state<string | null>(null);

export function getIsDirty() {
	return isDirty;
}

export function getLastSavedTime() {
	return lastSavedTime;
}

export function getLastSavedTemplateName() {
	return lastSavedTemplateName;
}

export function markDirty() {
	isDirty = true;
}

export function markClean(source?: { templateName?: string }) {
	isDirty = false;
	lastSavedTime = new Date().toISOString();
	// BUG-M12: Always update templateName — clear it when source is not provided
	lastSavedTemplateName = source?.templateName ?? null;
}
