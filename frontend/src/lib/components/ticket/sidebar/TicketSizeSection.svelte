<script lang="ts">
	import { getTicketSettings, setTicketType, setCustomSize } from '$lib/stores/ticket-settings.svelte';
	import type { TicketType } from '$lib/types/ticket';

	const settings = $derived(getTicketSettings());

	function handleTypeChange(e: Event) {
		setTicketType((e.target as HTMLSelectElement).value as TicketType);
	}

	function handleWidth(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		if (!isNaN(val) && val > 0) setCustomSize(val, settings.height);
	}

	function handleHeight(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		if (!isNaN(val) && val > 0) setCustomSize(settings.width, val);
	}
</script>

<details class="group rounded-lg border border-gray-200" open>
	<summary class="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-gray-700">
		<span>📐 Ticket Size</span>
		<svg class="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</summary>
	<div class="space-y-2 border-t border-gray-100 p-3">
		<select value={settings.type} onchange={handleTypeChange} class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" aria-label="Ticket type">
			<option value="ticket">Ticket (226.3 x 80 mm)</option>
			<option value="convention-id">Convention ID (101.6 x 152.4 mm)</option>
			<option value="certificate">Certificate (A4 Landscape)</option>
			<option value="others">Custom</option>
		</select>

		{#if settings.type === 'others'}
			<div class="flex gap-2">
				<div class="flex-1">
					<label for="ticket-width" class="mb-1 block text-xs text-gray-500">Width (mm)</label>
					<input id="ticket-width" type="number" value={settings.width} onchange={handleWidth} step="0.1" min="10" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
				</div>
				<div class="flex-1">
					<label for="ticket-height" class="mb-1 block text-xs text-gray-500">Height (mm)</label>
					<input id="ticket-height" type="number" value={settings.height} onchange={handleHeight} step="0.1" min="10" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
				</div>
			</div>
		{/if}

		<p class="text-xs text-gray-400">{settings.width.toFixed(1)} x {settings.height.toFixed(1)} mm</p>
	</div>
</details>
