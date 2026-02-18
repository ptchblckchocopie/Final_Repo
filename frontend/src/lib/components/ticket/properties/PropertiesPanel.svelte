<script lang="ts">
	import { getActiveElement } from '$lib/stores/selection.svelte';
	import TextProperties from './TextProperties.svelte';
	import QrProperties from './QrProperties.svelte';

	const active = $derived(getActiveElement());
</script>

{#if active}
	<details class="group rounded-lg border border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20" open>
		<summary class="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-red-800 dark:text-red-300">
			<span>⚙️ Properties</span>
			<svg class="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</summary>
		<div class="border-t border-red-100 dark:border-red-800 p-3">
			{#if active.type === 'text'}
				<TextProperties element={active} />
			{:else}
				<QrProperties element={active} />
			{/if}
		</div>
	</details>
{/if}
