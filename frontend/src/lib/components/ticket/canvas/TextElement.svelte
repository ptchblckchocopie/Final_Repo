<script lang="ts">
	import type { TextElement as TextElementType } from '$lib/types/ticket';
	import { updateElement } from '$lib/stores/elements.svelte';
	import { pushState } from '$lib/stores/history.svelte';
	import { draggable } from '$lib/actions/draggable';
	import { resizable } from '$lib/actions/resizable';
	import { rotatable } from '$lib/actions/rotatable';
	import { formatTextWithData } from '$lib/utils/format';

	interface Props {
		element: TextElementType;
		selected: boolean;
		zoom: number;
		previewData: Record<string, string> | null;
		onclick: (e: MouseEvent) => void;
	}

	const { element, selected, zoom, previewData, onclick }: Props = $props();

	let nodeEl: HTMLElement;

	const formattedText = $derived(
		previewData
			? formatTextWithData(element.textFormat, previewData)
			: element.textFormat
	);

	const isEmpty = $derived(!formattedText || formattedText.trim() === '');
	const displayText = $derived(isEmpty ? element.textFormat : formattedText);

	function handleDrag(id: string, x: number, y: number) {
		updateElement(id, { position: { x, y } });
	}

	function handleDragEnd() {
		pushState();
	}

	function handleResize(id: string, width: number, height: number) {
		updateElement(id, { size: { width, height } });
	}

	function handleResizeEnd() {
		pushState();
	}

	function handleRotate(id: string, degrees: number) {
		updateElement(id, { rotation: degrees });
	}

	function handleRotateEnd() {
		pushState();
	}

	function getCenter(): { x: number; y: number } {
		if (!nodeEl) return { x: 0, y: 0 };
		const rect = nodeEl.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={nodeEl}
	class="absolute cursor-move select-none {selected ? 'ring-2 ring-indigo-500' : ''} {element.containInBox && !element.allowOverflow ? 'overflow-hidden' : ''}"
	style="
		left: {element.position.x}px;
		top: {element.position.y}px;
		width: {element.size.width}px;
		height: {element.size.height}px;
		transform: rotate({element.rotation}deg);
		font-size: {element.styles.fontSize}px;
		color: {element.styles.color};
		font-family: '{element.styles.fontFamily}', sans-serif;
		font-weight: {element.styles.fontBold ? 'bold' : 'normal'};
		font-style: {element.styles.fontItalic ? 'italic' : 'normal'};
		text-decoration: {element.styles.fontUnderline ? 'underline' : 'none'};
		{element.styles.backgroundColor ? `background-color: ${element.styles.backgroundColor};` : ''}
		opacity: {element.styles.opacity ?? 1};
		text-align: {element.styles.horizontalAlign};
		display: flex;
		align-items: {element.styles.verticalAlign === 'top' ? 'flex-start' : element.styles.verticalAlign === 'bottom' ? 'flex-end' : 'center'};
		justify-content: {element.styles.horizontalAlign === 'left' ? 'flex-start' : element.styles.horizontalAlign === 'right' ? 'flex-end' : 'center'};
		line-height: 1.2;
		{element.disableNewLine ? 'white-space: nowrap;' : 'white-space: pre-wrap; word-wrap: break-word;'}
	"
	{onclick}
	onkeydown={() => {}}
	use:draggable={{
		zoom,
		getElementId: () => element.id,
		getPosition: () => element.position,
		onDrag: handleDrag,
		onDragEnd: handleDragEnd
	}}
>
	<span class="pointer-events-none w-full {isEmpty ? 'italic opacity-40' : ''}">{displayText}</span>

	{#if selected}
		<!-- Resize Handle -->
		<div
			class="resize-handle absolute -right-1.5 -bottom-1.5 z-10 h-3 w-3 cursor-se-resize rounded-sm bg-indigo-600"
			use:resizable={{
				zoom,
				getElementId: () => element.id,
				getSize: () => element.size,
				onResize: handleResize,
				onResizeEnd: handleResizeEnd
			}}
		></div>

		<!-- Rotate Handle -->
		<div
			class="rotate-handle absolute -top-6 left-1/2 z-10 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-indigo-600 bg-white"
			use:rotatable={{
				getElementId: () => element.id,
				getCenter,
				onRotate: handleRotate,
				onRotateEnd: handleRotateEnd
			}}
		></div>
		<div class="pointer-events-none absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-indigo-600"></div>
	{/if}
</div>
