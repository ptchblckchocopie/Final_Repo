<script lang="ts">
	import type { QrElement as QrElementType } from '$lib/types/ticket';
	import { updateElement } from '$lib/stores/elements.svelte';
	import { pushState } from '$lib/stores/history.svelte';
	import { draggable } from '$lib/actions/draggable';
	import { resizable } from '$lib/actions/resizable';
	import { rotatable } from '$lib/actions/rotatable';

	interface Props {
		element: QrElementType;
		selected: boolean;
		zoom: number;
		previewData: Record<string, string> | null;
		onclick: (e: MouseEvent) => void;
	}

	const { element, selected, zoom, previewData, onclick }: Props = $props();

	let canvasEl: HTMLCanvasElement;
	let nodeEl: HTMLElement;

	const codeValue = $derived(
		previewData && element.placeholder
			? (previewData[element.placeholder] || 'SAMPLE')
			: 'SAMPLE'
	);

	$effect(() => {
		if (!canvasEl) return;
		renderCode(codeValue);
	});

	async function renderCode(value: string) {
		if (!canvasEl) return;

		if (element.codeSettings.codeType === 'qr') {
			const QRious = (await import('qrious')).default;
			const size = Math.min(element.size.width, element.size.height);
			new QRious({
				element: canvasEl,
				value,
				size,
				background: element.codeSettings.background,
				foreground: element.codeSettings.foreground
			});

			// Render logo overlay if set
			if (element.codeSettings.customLogo) {
				const { addLogoToQR } = await import('$lib/utils/qr-generator');
				await addLogoToQR(canvasEl, size, element.codeSettings.customLogo);
			}
		} else {
			try {
				const JsBarcode = (await import('jsbarcode')).default;
				JsBarcode(canvasEl, value, {
					format: element.codeSettings.barcodeType || 'CODE128',
					width: 2,
					height: element.size.height * 0.7,
					displayValue: true,
					background: element.codeSettings.background,
					lineColor: element.codeSettings.foreground,
					fontSize: 12
				});
			} catch {
				const ctx = canvasEl.getContext('2d');
				if (ctx) {
					canvasEl.width = element.size.width;
					canvasEl.height = element.size.height;
					ctx.fillStyle = '#f3f4f6';
					ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
					ctx.fillStyle = '#9ca3af';
					ctx.font = '10px Arial';
					ctx.textAlign = 'center';
					ctx.fillText('Invalid barcode', canvasEl.width / 2, canvasEl.height / 2);
				}
			}
		}
	}

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
	class="absolute cursor-move {selected ? 'ring-2 ring-indigo-500' : ''}"
	style="
		left: {element.position.x}px;
		top: {element.position.y}px;
		width: {element.size.width}px;
		height: {element.size.height}px;
		transform: rotate({element.rotation}deg);
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
	<canvas
		bind:this={canvasEl}
		class="h-full w-full object-contain"
	></canvas>

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
