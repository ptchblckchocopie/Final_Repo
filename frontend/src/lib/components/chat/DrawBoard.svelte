<script lang="ts">
	import { onMount } from 'svelte';
	import type { Stroke, Point } from '$lib/types/drawing';
	import {
		registerDrawCallbacks,
		unregisterDrawCallbacks,
		sendDrawStroke,
		sendDrawStrokeProgress,
		sendDrawClear,
	} from '$lib/stores/chat-ws.svelte';

	const COLOR_PRESETS = [
		'#000000', '#ef4444', '#f97316', '#eab308',
		'#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
	];

	let canvasEl = $state<HTMLCanvasElement>(undefined!);
	let containerEl = $state<HTMLDivElement>(undefined!);
	let ctx = $state<CanvasRenderingContext2D | null>(null);

	let tool = $state<'pen' | 'eraser'>('pen');
	let color = $state('#000000');
	let brushWidth = $state(3);

	let isDrawing = $state(false);
	let currentPoints: Point[] = [];
	let currentStrokeId = '';
	let strokeHistory: Stroke[] = [];
	let lastProgressTime = 0;

	// Remote in-progress strokes keyed by strokeId
	let remoteProgress = new Map<string, { points: Point[]; color: string; width: number; tool: 'pen' | 'eraser' }>();

	onMount(() => {
		ctx = canvasEl.getContext('2d');
		resizeCanvas();

		const ro = new ResizeObserver(() => resizeCanvas());
		ro.observe(containerEl);

		registerDrawCallbacks({
			onStroke(stroke: Stroke) {
				strokeHistory.push(stroke);
				remoteProgress.delete(stroke.id);
				redrawAll();
			},
			onStrokeProgress(data) {
				remoteProgress.set(data.strokeId, {
					points: data.points,
					color: data.color,
					width: data.width,
					tool: data.tool,
				});
				redrawAll();
			},
			onClear() {
				strokeHistory = [];
				remoteProgress.clear();
				clearCanvas();
			},
			onSync(strokes: Stroke[]) {
				strokeHistory = strokes;
				redrawAll();
			},
		});

		return () => {
			ro.disconnect();
			unregisterDrawCallbacks();
		};
	});

	function resizeCanvas() {
		if (!canvasEl || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		canvasEl.width = rect.width * dpr;
		canvasEl.height = rect.height * dpr;
		canvasEl.style.width = `${rect.width}px`;
		canvasEl.style.height = `${rect.height}px`;
		if (ctx) {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		redrawAll();
	}

	function clearCanvas() {
		if (!ctx || !canvasEl) return;
		const rect = containerEl?.getBoundingClientRect();
		if (!rect) return;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
		ctx.restore();
		// Draw white background
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, rect.width, rect.height);
	}

	function redrawAll() {
		if (!ctx || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		clearCanvas();

		// Draw completed strokes
		for (const stroke of strokeHistory) {
			drawStrokeOnCanvas(stroke.points, stroke.color, stroke.width, stroke.tool, rect);
		}

		// Draw current local in-progress stroke
		if (isDrawing && currentPoints.length > 1) {
			drawStrokeOnCanvas(currentPoints, color, brushWidth, tool, rect);
		}

		// Draw remote in-progress strokes
		for (const [, data] of remoteProgress) {
			if (data.points.length > 1) {
				drawStrokeOnCanvas(data.points, data.color, data.width, data.tool, rect);
			}
		}
	}

	function drawStrokeOnCanvas(
		points: Point[],
		strokeColor: string,
		width: number,
		strokeTool: 'pen' | 'eraser',
		rect: DOMRect
	) {
		if (!ctx || points.length < 2) return;

		ctx.save();
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = width;

		if (strokeTool === 'eraser') {
			ctx.globalCompositeOperation = 'destination-out';
			ctx.strokeStyle = 'rgba(0,0,0,1)';
		} else {
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = strokeColor;
		}

		ctx.beginPath();
		ctx.moveTo(points[0].x * rect.width, points[0].y * rect.height);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x * rect.width, points[i].y * rect.height);
		}
		ctx.stroke();
		ctx.restore();
	}

	function generateId(): string {
		return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
	}

	function normalizePoint(e: PointerEvent): Point {
		const rect = canvasEl.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) / rect.width,
			y: (e.clientY - rect.top) / rect.height,
		};
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		isDrawing = true;
		currentStrokeId = generateId();
		currentPoints = [normalizePoint(e)];
		lastProgressTime = 0;
		canvasEl.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDrawing) return;
		const pt = normalizePoint(e);
		currentPoints.push(pt);

		// Redraw to show local progress
		redrawAll();

		// Throttle progress sends to ~50ms
		const now = performance.now();
		if (now - lastProgressTime >= 50) {
			lastProgressTime = now;
			sendDrawStrokeProgress({
				strokeId: currentStrokeId,
				points: [...currentPoints],
				color,
				width: brushWidth,
				tool,
			});
		}
	}

	function onPointerUp(_e: PointerEvent) {
		if (!isDrawing) return;
		isDrawing = false;

		if (currentPoints.length >= 2) {
			const stroke: Stroke = {
				id: currentStrokeId,
				sender: '',
				points: [...currentPoints],
				color,
				width: brushWidth,
				tool,
			};
			strokeHistory.push(stroke);
			sendDrawStroke({
				id: stroke.id,
				points: stroke.points,
				color: stroke.color,
				width: stroke.width,
				tool: stroke.tool,
			});
		}
		currentPoints = [];
		currentStrokeId = '';
		redrawAll();
	}

	function handleClear() {
		strokeHistory = [];
		remoteProgress.clear();
		clearCanvas();
		sendDrawClear();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
		<!-- Tool buttons -->
		<button
			onclick={() => (tool = 'pen')}
			class="rounded-lg px-2 py-1.5 text-xs font-medium transition-colors {tool === 'pen'
				? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
				: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			title="Pen"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
			</svg>
		</button>
		<button
			onclick={() => (tool = 'eraser')}
			class="rounded-lg px-2 py-1.5 text-xs font-medium transition-colors {tool === 'eraser'
				? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
				: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
			title="Eraser"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
			</svg>
		</button>

		<div class="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700"></div>

		<!-- Color presets -->
		<div class="flex gap-1">
			{#each COLOR_PRESETS as c}
				<button
					onclick={() => { color = c; tool = 'pen'; }}
					class="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 {color === c && tool === 'pen'
						? 'border-red-500 scale-110'
						: 'border-gray-300 dark:border-gray-600'}"
					style="background-color: {c};"
					title={c}
				></button>
			{/each}
			<input
				type="color"
				bind:value={color}
				onchange={() => (tool = 'pen')}
				class="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
				title="Custom color"
			/>
		</div>

		<div class="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700"></div>

		<!-- Brush width -->
		<input
			type="range"
			min="1"
			max="20"
			bind:value={brushWidth}
			class="w-16 accent-red-500"
			title="Brush size: {brushWidth}"
		/>
		<span class="text-xs text-gray-500 dark:text-gray-400 min-w-[1.5rem] text-center">{brushWidth}</span>

		<div class="flex-1"></div>

		<!-- Clear button -->
		<button
			onclick={handleClear}
			class="rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
			title="Clear canvas"
		>
			Clear
		</button>
	</div>

	<!-- Canvas -->
	<div bind:this={containerEl} class="relative flex-1 cursor-crosshair overflow-hidden bg-white">
		<canvas
			bind:this={canvasEl}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointerleave={onPointerUp}
			class="absolute inset-0 touch-none"
		></canvas>
	</div>
</div>
