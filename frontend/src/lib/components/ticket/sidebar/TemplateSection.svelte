<script lang="ts">
	import {
		getBuiltInTemplates,
		getUserTemplates,
		getBuiltInTemplate,
		fetchUserTemplates,
		saveTemplateToBackend,
		deleteTemplateFromBackend,
		getHasFetched,
		getIsLoading
	} from '$lib/stores/templates.svelte';
	import { setAllSettings, getTicketSettings } from '$lib/stores/ticket-settings.svelte';
	import { setElements, getElements } from '$lib/stores/elements.svelte';
	import { setBackgroundImage, getBackgroundImage } from '$lib/stores/canvas.svelte';
	import { setAllLabelConfig, getLabelConfig } from '$lib/stores/labels.svelte';
	import { getCsvData, getCsvHeaders, setCsvDirect, clearCSV } from '$lib/stores/csv.svelte';
	import { clearHistory } from '$lib/stores/history.svelte';
	import { clearSelection } from '$lib/stores/selection.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import { markClean, getLastSavedTemplateName } from '$lib/stores/dirty.svelte';
	import { getTicketGap, setTicketGap } from '$lib/stores/print-settings.svelte';
	import { BASE_URL } from '$lib/api/client';

	let selectedTemplateId = $state('');
	let isSaving = $state(false);
	let isDeleting = $state(false);
	let isLoadingTemplate = $state(false);

	let builtInTemplates = $derived(getBuiltInTemplates());
	let backendTemplates = $derived(getUserTemplates());

	$effect(() => {
		if (!getHasFetched() && !getIsLoading()) {
			fetchUserTemplates();
		}
	});

	function isBuiltInId(id: string): boolean {
		return id.startsWith('blank-');
	}

	async function fetchImageAsDataUrl(url: string): Promise<string> {
		const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
		const response = await fetch(fullUrl);
		const blob = await response.blob();
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	async function loadSelected() {
		if (!selectedTemplateId) return;

		if (isBuiltInId(selectedTemplateId)) {
			const tmpl = getBuiltInTemplate(selectedTemplateId);
			if (!tmpl) return;

			setAllSettings(tmpl.ticketSettings);
			setElements(tmpl.elements);
			setBackgroundImage(tmpl.backgroundImage);
			if (tmpl.labelBlock) {
				setAllLabelConfig({
					labelColumn: '',
					labelColors: {},
					labelBlockWidth: tmpl.labelBlock.width,
					rightBlockEnabled: false,
					rightBlockWidth: 20
				});
			}
			clearCSV();
			clearHistory();
			clearSelection();
			markClean({ templateName: tmpl.name });
			showToast('success', 'Template loaded', tmpl.name);
			return;
		}

		const templateId = Number(selectedTemplateId);
		const tmpl = backendTemplates.find((t) => t.id === templateId);
		if (!tmpl) return;

		isLoadingTemplate = true;
		try {
			setAllSettings(tmpl.ticketSettings);
			setElements(tmpl.elements);

			if (tmpl.labelConfig) {
				setAllLabelConfig(tmpl.labelConfig);
			} else {
				setAllLabelConfig({
					labelColumn: '',
					labelColors: {},
					labelBlockWidth: 50,
					rightBlockEnabled: false,
					rightBlockWidth: 20
				});
			}

			if (tmpl.csvData && tmpl.csvHeaders) {
				setCsvDirect(tmpl.csvData, tmpl.csvHeaders);
			} else {
				clearCSV();
			}

			if (tmpl.backgroundImage && typeof tmpl.backgroundImage === 'object' && tmpl.backgroundImage.url) {
				const dataUrl = await fetchImageAsDataUrl(tmpl.backgroundImage.url);
				setBackgroundImage(dataUrl);
			} else {
				setBackgroundImage(null);
			}

			setTicketGap(tmpl.printSettings?.ticketGap ?? 2);

			clearHistory();
			clearSelection();
			markClean({ templateName: tmpl.name });
			showToast('success', 'Template loaded', tmpl.name);
		} catch (err) {
			console.error('Failed to load template:', err);
			showToast('error', 'Failed to load template');
		} finally {
			isLoadingTemplate = false;
		}
	}

	async function saveAsCurrent() {
		const defaultName = getLastSavedTemplateName() ?? '';
		const name = prompt('Template name:', defaultName);
		if (!name) return;

		// Check if overwriting an existing template
		const existingMatch = backendTemplates.find(
			(t) => t.name.toLowerCase() === name.toLowerCase()
		);
		if (existingMatch) {
			if (!confirm(`A template named "${existingMatch.name}" already exists. Overwrite it?`)) return;
		}

		isSaving = true;
		try {
			const { wasOverwrite } = await saveTemplateToBackend(
				name,
				getBackgroundImage(),
				getTicketSettings(),
				getElements(),
				getLabelConfig(),
				getCsvData(),
				getCsvHeaders(),
				{ ticketGap: getTicketGap() }
			);
			markClean({ templateName: name });
			showToast('success', wasOverwrite ? 'Template updated' : 'Template saved', name);
		} catch (err) {
			console.error('Failed to save template:', err);
			showToast('error', 'Failed to save template');
		} finally {
			isSaving = false;
		}
	}

	async function deleteCurrent() {
		if (!selectedTemplateId || isBuiltInId(selectedTemplateId)) return;

		const templateId = Number(selectedTemplateId);
		const tmpl = backendTemplates.find((t) => t.id === templateId);
		if (!tmpl) return;

		if (!confirm(`Delete "${tmpl.name}"?`)) return;

		isDeleting = true;
		try {
			await deleteTemplateFromBackend(templateId);
			selectedTemplateId = '';
			showToast('success', 'Template deleted');
		} catch (err) {
			console.error('Failed to delete template:', err);
			showToast('error', 'Failed to delete template');
		} finally {
			isDeleting = false;
		}
	}

	const isAnyBusy = $derived(isSaving || isDeleting || isLoadingTemplate);
</script>

<details class="group rounded-lg border border-gray-200 dark:border-gray-700">
	<summary class="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
		<span>📋 Templates</span>
		<svg class="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</summary>
	<div class="space-y-2 border-t border-gray-100 dark:border-gray-700 p-3">
		<select bind:value={selectedTemplateId} disabled={isAnyBusy} class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 text-xs disabled:opacity-50">
			<option value="">Select template...</option>
			<optgroup label="Built-in">
				{#each builtInTemplates as tmpl}
					<option value={tmpl.id}>{tmpl.name}</option>
				{/each}
			</optgroup>
			{#if backendTemplates.length > 0}
				<optgroup label="Saved">
					{#each backendTemplates as tmpl}
						<option value={String(tmpl.id)}>{tmpl.name}</option>
					{/each}
				</optgroup>
			{/if}
		</select>
		<div class="flex gap-1">
			<button
				onclick={loadSelected}
				disabled={!selectedTemplateId || isAnyBusy}
				class="flex-1 cursor-pointer rounded bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{isLoadingTemplate ? 'Loading...' : 'Load'}
			</button>
			<button
				onclick={saveAsCurrent}
				disabled={isAnyBusy}
				class="flex-1 cursor-pointer rounded bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{isSaving ? 'Saving...' : 'Save Current'}
			</button>
			<button
				onclick={deleteCurrent}
				disabled={!selectedTemplateId || isBuiltInId(selectedTemplateId) || isAnyBusy}
				class="cursor-pointer rounded bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{isDeleting ? '...' : 'Delete'}
			</button>
		</div>
		{#if getIsLoading()}
			<p class="text-center text-xs text-gray-400 dark:text-gray-500">Loading templates...</p>
		{/if}
	</div>
</details>
