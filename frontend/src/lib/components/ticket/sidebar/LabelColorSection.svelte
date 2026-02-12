<script lang="ts">
	import { getCsvHeaders, getCsvData } from '$lib/stores/csv.svelte';
	import { getLabelConfig, setLabelColumn, assignLabelColor, setLabelBlockWidth, setRightBlockEnabled, setRightBlockWidth, getUniqueLabelValues } from '$lib/stores/labels.svelte';

	const headers = $derived(getCsvHeaders());
	const csvData = $derived(getCsvData());
	const config = $derived(getLabelConfig());
	const uniqueValues = $derived(getUniqueLabelValues(csvData));

	function handleColumnChange(e: Event) {
		setLabelColumn((e.target as HTMLSelectElement).value);
	}

	function handleColorChange(value: string, e: Event) {
		assignLabelColor(value, (e.target as HTMLInputElement).value);
	}

	function handleWidthChange(e: Event) {
		setLabelBlockWidth(parseInt((e.target as HTMLInputElement).value) || 50);
	}
</script>

{#if headers.length > 0}
	<details class="group rounded-lg border border-gray-200">
		<summary class="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-gray-700">
			<span>🏷️ Label Colors</span>
			<svg class="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</summary>
		<div class="space-y-3 border-t border-gray-100 p-3">
			<div>
				<label for="label-column" class="mb-1 block text-xs font-medium text-gray-500">Label Column</label>
				<select id="label-column" value={config.labelColumn} onchange={handleColumnChange} class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
					<option value="">None</option>
					{#each headers as header}
						<option value={header}>{header}</option>
					{/each}
				</select>
			</div>

			{#if uniqueValues.length > 0}
				<div>
					<label for="label-block-width" class="mb-1 block text-xs font-medium text-gray-500">Block Width (px)</label>
					<input id="label-block-width" type="number" value={config.labelBlockWidth} onchange={handleWidthChange} min="5" max="80" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
				</div>

				<div>
					<label class="flex items-center gap-2 text-xs text-gray-600">
						<input type="checkbox" checked={config.rightBlockEnabled} onchange={() => setRightBlockEnabled(!config.rightBlockEnabled)} class="rounded" />
						Right-side block
					</label>
				</div>

				{#if config.rightBlockEnabled}
					<div>
						<label for="right-block-width" class="mb-1 block text-xs font-medium text-gray-500">Right Block Width</label>
						<input id="right-block-width" type="number" value={config.rightBlockWidth} onchange={(e) => setRightBlockWidth(parseInt((e.target as HTMLInputElement).value) || 20)} min="5" max="80" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
					</div>
				{/if}

				<div class="max-h-32 space-y-1.5 overflow-y-auto">
					{#each uniqueValues as value}
						<div class="flex items-center gap-2">
							<input
								type="color"
								value={config.labelColors[value] || '#cccccc'}
								onchange={(e) => handleColorChange(value, e)}
								class="h-6 w-6 cursor-pointer rounded border-0"
								aria-label="Color for {value}"
							/>
							<span class="truncate text-xs text-gray-600">{value}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</details>
{/if}
