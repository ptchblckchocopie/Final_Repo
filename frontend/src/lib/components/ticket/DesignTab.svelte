<script lang="ts">
	import Sidebar from './sidebar/Sidebar.svelte';
	import DesignCanvas from './canvas/DesignCanvas.svelte';
	import { shortcuts } from '$lib/actions/keyboard-shortcuts';
	import { undo, redo } from '$lib/stores/history.svelte';
	import { selectAll, copySelected, cutSelected, getClipboard, clearSelection, getSelectedIds } from '$lib/stores/selection.svelte';
	import { removeElements, addTextElement, addQrElement } from '$lib/stores/elements.svelte';
	import { pushState } from '$lib/stores/history.svelte';
	import { zoomIn, zoomOut, resetZoom } from '$lib/stores/canvas.svelte';
	import type { TicketElement } from '$lib/types/ticket';

	let sidebarOpen = $state(true);

	function handleDelete() {
		const ids = getSelectedIds();
		if (ids.size > 0) {
			pushState();
			removeElements(ids);
			clearSelection();
		}
	}

	function handleCut() {
		const ids = cutSelected();
		if (ids.size > 0) {
			pushState();
			removeElements(ids);
			clearSelection();
		}
	}

	function handlePaste() {
		const items = getClipboard();
		if (items.length > 0) {
			pushState();
			const newIds = new Set<string>();
			for (const item of items) {
				if (item.type === 'text') {
					const el = addTextElement(item as any);
					newIds.add(el.id);
				} else {
					const el = addQrElement(item as any);
					newIds.add(el.id);
				}
			}
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-full"
	use:shortcuts={{
		onUndo: undo,
		onRedo: redo,
		onSelectAll: selectAll,
		onCopy: copySelected,
		onCut: handleCut,
		onPaste: handlePaste,
		onDelete: handleDelete,
		onZoomIn: zoomIn,
		onZoomOut: zoomOut,
		onZoomReset: resetZoom
	}}
	tabindex="-1"
>
	<!-- Mobile Sidebar Toggle -->
	<button
		onclick={() => (sidebarOpen = !sidebarOpen)}
		class="fixed bottom-4 left-4 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white shadow-lg md:hidden"
		aria-label="Toggle sidebar"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			{#if sidebarOpen}
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			{:else}
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
			{/if}
		</svg>
	</button>

	<!-- Sidebar -->
	<div
		class="h-full w-72 flex-shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-transform duration-300 max-md:fixed max-md:left-0 max-md:top-16 max-md:z-20 max-md:bottom-0 max-md:shadow-xl {sidebarOpen
			? 'max-md:translate-x-0'
			: 'max-md:-translate-x-full'}"
	>
		<Sidebar />
	</div>

	<!-- Backdrop for mobile -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-10 bg-black/30 md:hidden"
			onclick={() => (sidebarOpen = false)}
			onkeydown={() => {}}
		></div>
	{/if}

	<!-- Canvas Area -->
	<div class="min-w-0 flex-1">
		<DesignCanvas />
	</div>
</div>
