<script lang="ts">
	import { getElements, setElements, clearElements } from '$lib/stores/elements.svelte';
	import { getCsvData, getCsvHeaders, setCsvDirect, clearCSV } from '$lib/stores/csv.svelte';
	import { getTicketSettings, setAllSettings } from '$lib/stores/ticket-settings.svelte';
	import { getBackgroundImage, setBackgroundImage } from '$lib/stores/canvas.svelte';
	import { getLabelConfig, setAllLabelConfig } from '$lib/stores/labels.svelte';
	import { clearSelection } from '$lib/stores/selection.svelte';
	import { clearHistory } from '$lib/stores/history.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import { markClean, getIsDirty, getLastSavedTime, getLastSavedTemplateName } from '$lib/stores/dirty.svelte';
	import { clearAutosave } from '$lib/stores/autosave.svelte';
	import { getTicketGap, setTicketGap } from '$lib/stores/print-settings.svelte';
	import type { ProjectData } from '$lib/types/ticket';

	const isDirty = $derived(getIsDirty());
	const lastSavedTime = $derived(getLastSavedTime());
	const lastSavedTemplateName = $derived(getLastSavedTemplateName());

	function formatRelativeTime(iso: string | null): string {
		if (!iso) return '';
		const diff = Date.now() - new Date(iso).getTime();
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function exportProject() {
		const project: ProjectData = {
			version: '1.0',
			timestamp: new Date().toISOString(),
			csvData: getCsvData(),
			csvHeaders: getCsvHeaders(),
			backgroundImage: getBackgroundImage(),
			ticketSettings: getTicketSettings(),
			printSettings: { ticketGap: getTicketGap() },
			labelSettings: getLabelConfig(),
			elements: JSON.parse(JSON.stringify(getElements()))
		};

		const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const now = new Date();
		a.href = url;
		a.download = `ticket_project_${now.toISOString().slice(0, 10)}.veenttix`;
		a.click();
		URL.revokeObjectURL(url);

		markClean();
		showToast('success', 'Project exported');
	}

	function importProject(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				const project: ProjectData = JSON.parse(ev.target?.result as string);

				setAllSettings(project.ticketSettings);
				setElements(project.elements);
				setBackgroundImage(project.backgroundImage);
				setAllLabelConfig(project.labelSettings);
				setTicketGap(project.printSettings?.ticketGap ?? 2);

				if (project.csvData && project.csvHeaders) {
					setCsvDirect(project.csvData, project.csvHeaders);
				}

				clearHistory();
				clearSelection();

				markClean();
				showToast('success', 'Project imported');
			} catch {
				showToast('error', 'Import failed', 'Invalid project file');
			}
		};
		reader.readAsText(file);
		input.value = '';
	}

	function clearProject() {
		if (!confirm('Clear all? This cannot be undone.')) return;
		clearElements();
		clearCSV();
		setBackgroundImage(null);
		clearSelection();
		clearHistory();
		clearAutosave();
		markClean();
		showToast('info', 'Project cleared');
	}
</script>

<details class="group rounded-lg border border-gray-200 dark:border-gray-700">
	<summary class="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
		<span class="flex items-center gap-2">
			<span>Project</span>
			{#if isDirty}
				<span class="inline-block h-2 w-2 rounded-full bg-red-400" title="Unsaved changes"></span>
			{:else if lastSavedTime}
				<span class="inline-block h-2 w-2 rounded-full bg-red-400" title="Saved"></span>
			{/if}
		</span>
		<svg class="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</summary>
	<div class="space-y-2 border-t border-gray-100 dark:border-gray-700 p-3">
		<!-- Dirty-state indicator -->
		{#if isDirty}
			<div class="flex items-center gap-1.5 rounded bg-red-50 dark:bg-red-900/30 px-2 py-1">
				<span class="inline-block h-1.5 w-1.5 rounded-full bg-red-400"></span>
				<span class="text-xs text-red-700 dark:text-red-300">Unsaved changes</span>
			</div>
		{:else if lastSavedTime}
			<div class="flex items-center gap-1.5 rounded bg-red-50 dark:bg-red-900/30 px-2 py-1">
				<span class="inline-block h-1.5 w-1.5 rounded-full bg-red-400"></span>
				<span class="text-xs text-red-700 dark:text-red-300">
					Saved {formatRelativeTime(lastSavedTime)}{lastSavedTemplateName ? ` (${lastSavedTemplateName})` : ''}
				</span>
			</div>
		{/if}

		<div class="flex gap-1">
			<button onclick={exportProject} class="flex-1 cursor-pointer rounded bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50">Export</button>
			<label class="flex flex-1 cursor-pointer items-center justify-center rounded bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50">
				Import
				<input type="file" accept=".veenttix" onchange={importProject} class="hidden" />
			</label>
			<button onclick={clearProject} class="cursor-pointer rounded bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50">Clear</button>
		</div>
	</div>
</details>
