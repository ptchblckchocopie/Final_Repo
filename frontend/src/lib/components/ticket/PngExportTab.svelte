<script lang="ts">
	import { getElements } from '$lib/stores/elements.svelte';
	import { getCsvData } from '$lib/stores/csv.svelte';
	import { getTicketSettings } from '$lib/stores/ticket-settings.svelte';
	import { getBackgroundImage, getBackgroundFitMode } from '$lib/stores/canvas.svelte';
	import { getLabelConfig } from '$lib/stores/labels.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import { exportAllAsPNG } from '$lib/utils/png-export';
	import { renderTicketToCanvas } from '$lib/utils/canvas-render';
	import { SCALE_FACTOR } from '$lib/types/ticket';
	import LoadingOverlay from '$lib/components/ui/LoadingOverlay.svelte';

	const elements = $derived(getElements());
	const csvData = $derived(getCsvData());
	const settings = $derived(getTicketSettings());
	const bg = $derived(getBackgroundImage());
	const fitMode = $derived(getBackgroundFitMode());
	const labelConfig = $derived(getLabelConfig());

	let quality = $state(1);
	let exporting = $state(false);
	let progress = $state(0);
	let previewImages = $state<string[]>([]);

	const qualityOptions = [
		{ value: 1, label: 'Standard (72 DPI)' },
		{ value: 2, label: 'High (144 DPI)' },
		{ value: 3, label: 'Print (216 DPI)' }
	];

	async function generatePreviews() {
		if (csvData.length === 0) {
			showToast('warning', 'No data', 'Upload CSV data first');
			return;
		}

		exporting = true;
		progress = 0;
		previewImages = [];

		try {
			const images: string[] = [];
			for (let i = 0; i < csvData.length; i++) {
				progress = ((i + 1) / csvData.length) * 100;
				const canvas = await renderTicketToCanvas(elements, csvData[i], {
					width: settings.width * SCALE_FACTOR,
					height: settings.height * SCALE_FACTOR,
					quality: 1,
					backgroundImage: bg,
					fitMode,
					labelConfig
				});
				images.push(canvas.toDataURL('image/png'));

				if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
			}
			previewImages = images;
		} finally {
			exporting = false;
		}
	}

	async function handleExport() {
		if (csvData.length === 0) {
			showToast('warning', 'No data', 'Upload CSV data first');
			return;
		}

		exporting = true;
		progress = 0;

		try {
			const blob = await exportAllAsPNG(elements, csvData, {
				width: settings.width * SCALE_FACTOR,
				height: settings.height * SCALE_FACTOR,
				quality,
				backgroundImage: bg,
				fitMode,
				labelConfig
			}, (current, total) => {
				progress = (current / total) * 100;
			});

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `tickets_${new Date().toISOString().slice(0, 10)}.zip`;
			a.click();
			URL.revokeObjectURL(url);

			showToast('success', 'Export complete', `${csvData.length} tickets exported`);
		} catch (err) {
			showToast('error', 'Export failed', (err as Error).message);
		} finally {
			exporting = false;
		}
	}
</script>

<LoadingOverlay visible={exporting} message="Exporting tickets..." {progress} />

<div class="flex h-full flex-col">
	<!-- Controls -->
	<div class="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-4 py-3">
		<div class="flex items-center gap-2">
			<label for="export-quality" class="text-xs font-medium text-gray-600">Quality:</label>
			<select id="export-quality" bind:value={quality} class="rounded border border-gray-300 px-2 py-1.5 text-xs">
				{#each qualityOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="ml-auto flex gap-2">
			<button
				onclick={generatePreviews}
				disabled={exporting}
				class="cursor-pointer rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
			>
				Preview All
			</button>
			<button
				onclick={handleExport}
				disabled={exporting || csvData.length === 0}
				class="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
			>
				Download ZIP ({csvData.length} tickets)
			</button>
		</div>
	</div>

	<!-- Preview Grid -->
	<div class="flex-1 overflow-auto bg-gray-200 p-6">
		{#if previewImages.length > 0}
			<div class="mx-auto grid max-w-5xl gap-4" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
				{#each previewImages as src, i}
					<div class="overflow-hidden rounded-lg bg-white shadow-sm">
						<img {src} alt="Ticket {i + 1}" class="w-full" />
						<p class="p-2 text-center text-xs text-gray-400">#{i + 1}</p>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex h-full items-center justify-center">
				<div class="text-center text-gray-400">
					<p class="text-lg">PNG Export</p>
					<p class="mt-1 text-sm">Click "Preview All" to see tickets, or "Download ZIP" to export directly</p>
				</div>
			</div>
		{/if}
	</div>
</div>
