<script lang="ts">
	import { getElements, addTextElement, updateElement } from '$lib/stores/elements.svelte';
	import { getZoom, zoomIn, zoomOut, resetZoom, getBackgroundImage, getBackgroundFitMode } from '$lib/stores/canvas.svelte';
	import { getTicketSettings } from '$lib/stores/ticket-settings.svelte';
	import { clearSelection, isSelected, select, toggleSelect } from '$lib/stores/selection.svelte';
	import { pushState } from '$lib/stores/history.svelte';
	import { getCsvData } from '$lib/stores/csv.svelte';
	import { getLabelConfig } from '$lib/stores/labels.svelte';
	import { dropzone } from '$lib/actions/dropzone';
	import { formatTextWithData } from '$lib/utils/format';
	import TextElement from './TextElement.svelte';
	import QrElement from './QrElement.svelte';
	import ZoomControls from './ZoomControls.svelte';
	import { SCALE_FACTOR } from '$lib/types/ticket';

	const elements = $derived(getElements());
	const zoom = $derived(getZoom());
	const settings = $derived(getTicketSettings());
	const bg = $derived(getBackgroundImage());
	const fitMode = $derived(getBackgroundFitMode());
	const csvData = $derived(getCsvData());
	const labelConfig = $derived(getLabelConfig());

	const canvasWidth = $derived(settings.width * SCALE_FACTOR);
	const canvasHeight = $derived(settings.height * SCALE_FACTOR);

	const previewRow = $derived(csvData.length > 0 ? csvData[0] : null);

	function bgStyle(): string {
		if (!bg) return '';
		const sizeMap: Record<string, string> = {
			cover: 'background-size: cover; background-position: center;',
			contain: 'background-size: contain; background-position: center; background-repeat: no-repeat;',
			stretch: 'background-size: 100% 100%;',
			original: 'background-size: auto; background-position: top left; background-repeat: no-repeat;'
		};
		return `background-image: url(${bg}); ${sizeMap[fitMode] || sizeMap.cover}`;
	}

	function handleDrop(text: string, x: number, y: number) {
		pushState();
		addTextElement({ textFormat: text, position: { x, y } });
	}

	function handleCanvasClick(e: MouseEvent) {
		if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-inner')) {
			clearSelection();
		}
	}

	function handleElementClick(id: string, e: MouseEvent) {
		e.stopPropagation();
		if (e.ctrlKey || e.metaKey) {
			toggleSelect(id);
		} else {
			select(id);
		}
	}

	function handleWheel(e: WheelEvent) {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			if (e.deltaY < 0) zoomIn();
			else zoomOut();
		}
	}

	function getLabelBlockColor(): string | null {
		if (!labelConfig.labelColumn || !previewRow) return null;
		const val = previewRow[labelConfig.labelColumn];
		return val ? (labelConfig.labelColors[val] || '#cccccc') : null;
	}
</script>

<div
	class="flex h-full flex-col items-center overflow-auto bg-gray-200 dark:bg-gray-800 p-8"
	role="region"
	aria-label="Design canvas"
	onwheel={handleWheel}
>
	<ZoomControls />

	<!-- Canvas Container -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative shadow-2xl transition-transform duration-150"
		style="width: {canvasWidth}px; height: {canvasHeight}px; transform: scale({zoom}); transform-origin: top center;"
		onclick={handleCanvasClick}
		onkeydown={() => {}}
		use:dropzone={{ onDrop: handleDrop, zoom }}
	>
		<!-- Background -->
		<div
			class="canvas-inner absolute inset-0 bg-white"
			style={bgStyle()}
		></div>

		<!-- Label Color Block (left) -->
		{#if getLabelBlockColor()}
			<div
				class="pointer-events-none absolute top-0 bottom-0 left-0"
				style="width: {labelConfig.labelBlockWidth}px; background-color: {getLabelBlockColor()};"
			></div>
		{/if}

		<!-- Label Color Block (right) -->
		{#if getLabelBlockColor() && labelConfig.rightBlockEnabled}
			<div
				class="pointer-events-none absolute top-0 right-0 bottom-0"
				style="width: {labelConfig.rightBlockWidth}px; background-color: {getLabelBlockColor()};"
			></div>
		{/if}

		<!-- Drop zone indicator -->
		<div class="drop-indicator pointer-events-none absolute inset-0 hidden border-2 border-dashed border-red-400 bg-red-50/20"></div>

		<!-- Elements -->
		{#each elements as el (el.id)}
			{#if el.type === 'text'}
				<TextElement
					element={el}
					selected={isSelected(el.id)}
					{zoom}
					previewData={previewRow}
					onclick={(e) => handleElementClick(el.id, e)}
				/>
			{:else}
				<QrElement
					element={el}
					selected={isSelected(el.id)}
					{zoom}
					previewData={previewRow}
					onclick={(e) => handleElementClick(el.id, e)}
				/>
			{/if}
		{/each}
	</div>
</div>

<style>
	:global(.drop-active) .drop-indicator {
		display: block !important;
	}
</style>
