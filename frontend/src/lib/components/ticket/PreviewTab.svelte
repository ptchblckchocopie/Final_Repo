<script lang="ts">
	import { getElements } from '$lib/stores/elements.svelte';
	import { getCsvData } from '$lib/stores/csv.svelte';
	import { getTicketSettings } from '$lib/stores/ticket-settings.svelte';
	import { getBackgroundImage, getBackgroundFitMode } from '$lib/stores/canvas.svelte';
	import { getLabelConfig, getUniqueLabelValues } from '$lib/stores/labels.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import { renderTicketToCanvas } from '$lib/utils/canvas-render';
	import { calculateLayout } from '$lib/utils/print-layout';
	import { SCALE_FACTOR } from '$lib/types/ticket';
	import Modal from '$lib/components/ui/Modal.svelte';

	const elements = $derived(getElements());
	const csvData = $derived(getCsvData());
	const settings = $derived(getTicketSettings());
	const bg = $derived(getBackgroundImage());
	const fitMode = $derived(getBackgroundFitMode());
	const labelConfig = $derived(getLabelConfig());
	const uniqueLabels = $derived(getUniqueLabelValues(csvData));

	let gap = $state(2);
	let filterLabel = $state('all');
	let previewImages = $state<string[]>([]);
	let generating = $state(false);
	let showPrintModal = $state(false);
	let viewMode = $state<'pages' | 'grid'>('pages');

	const filteredData = $derived(
		filterLabel === 'all'
			? csvData
			: csvData.filter((row) =>
				labelConfig.labelColumn ? row[labelConfig.labelColumn] === filterLabel : true
			)
	);

	const layout = $derived(calculateLayout(settings.width, settings.height, gap, settings.type, filteredData.length));

	// Calculate the rendered ticket size to fit within the page grid
	const renderedTicketSize = $derived.by(() => {
		const availW = layout.availableWidth;
		const availH = layout.availableHeight;
		const totalGapW = (layout.ticketsPerRow - 1) * gap;
		const totalGapH = (layout.ticketsPerCol - 1) * gap;
		const cellW = (availW - totalGapW) / layout.ticketsPerRow;
		const cellH = (availH - totalGapH) / layout.ticketsPerCol;
		return { width: cellW, height: cellH };
	});

	// Group ticket images into pages
	const pages = $derived.by(() => {
		if (previewImages.length === 0 || layout.ticketsPerPage === 0) return [];
		const result: string[][] = [];
		for (let i = 0; i < previewImages.length; i += layout.ticketsPerPage) {
			result.push(previewImages.slice(i, i + layout.ticketsPerPage));
		}
		return result;
	});

	async function generatePreview() {
		if (filteredData.length === 0) {
			showToast('warning', 'No data', 'Upload CSV data first');
			return;
		}

		generating = true;
		previewImages = [];

		try {
			const images: string[] = [];
			for (let i = 0; i < filteredData.length; i++) {
				const canvas = await renderTicketToCanvas(elements, filteredData[i], {
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
			showToast('success', 'Preview generated', `${images.length} tickets`);
		} catch (err) {
			showToast('error', 'Preview failed', (err as Error).message);
		} finally {
			generating = false;
		}
	}

	function handlePrint() {
		showPrintModal = true;
	}

	function doPrint() {
		showPrintModal = false;

		const printWindow = window.open('', '_blank');
		if (!printWindow) return;

		const isLandscape = layout.orientation === 'landscape';
		const pageW = isLandscape ? 297 : 210;
		const pageH = isLandscape ? 210 : 297;
		const margin = 10;

		let html = `<!DOCTYPE html><html><head><style>
			@page { size: ${isLandscape ? 'landscape' : 'portrait'}; margin: 0; }
			* { margin: 0; padding: 0; box-sizing: border-box; }
			body { width: ${pageW}mm; }
			.page { width: ${pageW}mm; height: ${pageH}mm; position: relative; page-break-after: always; padding: ${margin}mm; }
			.ticket { position: absolute; }
			.cut-line-h, .cut-line-v { position: absolute; border: 0; }
			.cut-line-h { border-top: 0.5px dashed #ccc; height: 0; }
			.cut-line-v { border-left: 0.5px dashed #ccc; width: 0; }
			img { display: block; }
			@media print { .cut-line-h, .cut-line-v { border-color: #ddd; } }
		</style></head><body>`;

		const tw = renderedTicketSize.width;
		const th = renderedTicketSize.height;

		let ticketIdx = 0;
		for (let p = 0; p < layout.totalPages; p++) {
			html += '<div class="page">';

			// Tickets
			for (let row = 0; row < layout.ticketsPerCol; row++) {
				for (let col = 0; col < layout.ticketsPerRow; col++) {
					if (ticketIdx >= previewImages.length) break;
					const x = col * (tw + gap);
					const y = row * (th + gap);
					html += `<div class="ticket" style="left:${x + margin}mm;top:${y + margin}mm;width:${tw}mm;height:${th}mm;">`;
					html += `<img src="${previewImages[ticketIdx]}" style="width:100%;height:100%;" />`;
					html += '</div>';
					ticketIdx++;
				}
			}

			// Cut lines - horizontal
			for (let row = 1; row < layout.ticketsPerCol; row++) {
				const y = row * (th + gap) - gap / 2;
				html += `<div class="cut-line-h" style="left:${margin - 2}mm;top:${y + margin}mm;width:${layout.ticketsPerRow * (tw + gap) - gap + 4}mm;"></div>`;
			}

			// Cut lines - vertical
			for (let col = 1; col < layout.ticketsPerRow; col++) {
				const x = col * (tw + gap) - gap / 2;
				html += `<div class="cut-line-v" style="left:${x + margin}mm;top:${margin - 2}mm;height:${layout.ticketsPerCol * (th + gap) - gap + 4}mm;"></div>`;
			}

			html += '</div>';
		}

		html += '</body></html>';
		printWindow.document.write(html);
		printWindow.document.close();
		printWindow.onload = () => printWindow.print();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Controls Bar -->
	<div class="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
		<div class="flex items-center gap-2">
			<label class="text-xs font-medium text-gray-600">Gap (mm):</label>
			<input type="number" bind:value={gap} min="0" max="20" step="0.5" class="w-16 rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>

		<!-- View mode toggle -->
		{#if previewImages.length > 0}
			<div class="flex rounded border border-gray-300">
				<button
					onclick={() => (viewMode = 'pages')}
					class="cursor-pointer px-3 py-1 text-xs font-medium {viewMode === 'pages' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}"
				>Pages</button>
				<button
					onclick={() => (viewMode = 'grid')}
					class="cursor-pointer px-3 py-1 text-xs font-medium {viewMode === 'grid' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}"
				>Grid</button>
			</div>
		{/if}

		{#if uniqueLabels.length > 0}
			<div class="flex flex-wrap gap-1">
				<button
					onclick={() => (filterLabel = 'all')}
					class="cursor-pointer rounded-full px-3 py-1 text-xs font-medium {filterLabel === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
				>All</button>
				{#each uniqueLabels as label}
					<button
						onclick={() => (filterLabel = label)}
						class="cursor-pointer rounded-full px-3 py-1 text-xs font-medium {filterLabel === label ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
					>{label}</button>
				{/each}
			</div>
		{/if}

		<div class="ml-auto flex gap-2">
			<button
				onclick={generatePreview}
				disabled={generating}
				class="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
			>
				{generating ? 'Generating...' : 'Generate Preview'}
			</button>
			{#if previewImages.length > 0}
				<button
					onclick={handlePrint}
					class="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
				>
					Print
				</button>
			{/if}
		</div>
	</div>

	<!-- Stats -->
	{#if previewImages.length > 0}
		<div class="flex gap-4 bg-gray-50 px-4 py-2 text-xs text-gray-500">
			<span>Tickets: {filteredData.length}</span>
			<span>Pages: {layout.totalPages}</span>
			<span>Per page: {layout.ticketsPerPage}</span>
			<span>Layout: {layout.ticketsPerRow}x{layout.ticketsPerCol} ({layout.orientation})</span>
		</div>
	{/if}

	<!-- Preview Area -->
	<div class="flex-1 overflow-auto bg-gray-300 p-6">
		{#if previewImages.length > 0}
			{#if viewMode === 'pages'}
				<!-- A4 Page Layout View -->
				<div class="mx-auto flex flex-col items-center gap-8">
					{#each pages as page, pageIdx}
						<div class="relative">
							<!-- Page number -->
							<p class="mb-2 text-center text-xs font-medium text-gray-500">Page {pageIdx + 1} of {pages.length}</p>

							<!-- A4 page -->
							<div
								class="relative bg-white shadow-lg"
								style="
									width: {(layout.orientation === 'landscape' ? 297 : 210) * 2.5}px;
									height: {(layout.orientation === 'landscape' ? 210 : 297) * 2.5}px;
									padding: {10 * 2.5}px;
								"
							>
								<!-- Tickets on this page -->
								{#each page as src, i}
									{@const row = Math.floor(i / layout.ticketsPerRow)}
									{@const col = i % layout.ticketsPerRow}
									<div
										class="absolute overflow-hidden"
										style="
											left: {(col * (renderedTicketSize.width + gap) + 10) * 2.5}px;
											top: {(row * (renderedTicketSize.height + gap) + 10) * 2.5}px;
											width: {renderedTicketSize.width * 2.5}px;
											height: {renderedTicketSize.height * 2.5}px;
										"
									>
										<img {src} alt="Ticket {pageIdx * layout.ticketsPerPage + i + 1}" class="h-full w-full object-fill" />
									</div>
								{/each}

								<!-- Cut lines - horizontal (between rows) -->
								{#each Array(Math.max(0, Math.min(page.length > 0 ? Math.ceil(page.length / layout.ticketsPerRow) : 0, layout.ticketsPerCol) - 1)) as _, r}
									<div
										class="absolute border-t border-dashed border-gray-300"
										style="
											left: {(10 - 2) * 2.5}px;
											top: {((r + 1) * (renderedTicketSize.height + gap) - gap / 2 + 10) * 2.5}px;
											width: {(Math.min(layout.ticketsPerRow, page.length) * (renderedTicketSize.width + gap) - gap + 4) * 2.5}px;
										"
									></div>
								{/each}

								<!-- Cut lines - vertical (between columns) -->
								{#each Array(Math.max(0, Math.min(layout.ticketsPerRow, page.length) - 1)) as _, c}
									<div
										class="absolute border-l border-dashed border-gray-300"
										style="
											left: {((c + 1) * (renderedTicketSize.width + gap) - gap / 2 + 10) * 2.5}px;
											top: {(10 - 2) * 2.5}px;
											height: {(Math.ceil(page.length / layout.ticketsPerRow) * (renderedTicketSize.height + gap) - gap + 4) * 2.5}px;
										"
									></div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Grid View -->
				<div class="mx-auto grid max-w-5xl gap-4" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
					{#each previewImages as src, i}
						<div class="overflow-hidden rounded-lg bg-white shadow-sm">
							<img {src} alt="Ticket {i + 1}" class="w-full" />
							<p class="p-2 text-center text-xs text-gray-400">#{i + 1}</p>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="flex h-full items-center justify-center">
				<div class="text-center text-gray-400">
					<svg class="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
					</svg>
					<p class="mt-4 text-lg font-medium">No preview yet</p>
					<p class="mt-1 text-sm">Click "Generate Preview" to see your tickets laid out on A4 pages</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Print Reminder Modal -->
<Modal open={showPrintModal} title="Print Settings Reminder" onclose={() => (showPrintModal = false)}>
	<div class="space-y-4">
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
			<h4 class="mb-2 text-sm font-semibold text-amber-800">Important: Set margins to None</h4>
			<p class="text-sm text-amber-700">
				For tickets to print at the correct size, you must set your printer margins to <strong>None</strong>
				in the print dialog. The layout already includes 10mm margins.
			</p>
		</div>
		<div class="rounded-lg bg-gray-50 p-3">
			<p class="text-xs font-medium text-gray-700">How to set margins:</p>
			<ol class="mt-2 space-y-1 text-xs text-gray-600">
				<li>1. In the print dialog, click <strong>More Settings</strong></li>
				<li>2. Find the <strong>Margins</strong> dropdown</li>
				<li>3. Select <strong>None</strong></li>
				<li>4. Make sure <strong>Scale</strong> is set to <strong>100%</strong></li>
			</ol>
		</div>
		<div class="flex gap-4 text-xs text-gray-500">
			<span>Pages: {layout.totalPages}</span>
			<span>Orientation: {layout.orientation}</span>
			<span>Tickets: {previewImages.length}</span>
		</div>
		<div class="flex justify-end gap-2">
			<button onclick={() => (showPrintModal = false)} class="cursor-pointer rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
			<button onclick={doPrint} class="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">Continue to Print</button>
		</div>
	</div>
</Modal>
