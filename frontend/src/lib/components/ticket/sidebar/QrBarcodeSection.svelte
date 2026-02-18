<script lang="ts">
	import { getCsvHeaders } from '$lib/stores/csv.svelte';
	import { addQrElement } from '$lib/stores/elements.svelte';
	import { pushState } from '$lib/stores/history.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { CodeType, BarcodeFormat } from '$lib/types/ticket';

	const headers = $derived(getCsvHeaders());

	let selectedColumn = $state('');
	let codeType = $state<CodeType>('qr');
	let barcodeFormat = $state<BarcodeFormat>('CODE128');

	function addCode() {
		if (!selectedColumn) {
			showToast('warning', 'Select a column', 'Choose a CSV column for the QR/barcode data');
			return;
		}

		pushState();
		addQrElement({
			placeholder: selectedColumn,
			position: { x: 20, y: 20 },
			codeSettings: {
				codeType,
				background: '#ffffff',
				foreground: '#000000',
				barcodeType: codeType === 'barcode' ? barcodeFormat : undefined
			}
		});
		showToast('success', `${codeType === 'qr' ? 'QR Code' : 'Barcode'} added`);
	}
</script>

{#if headers.length > 0}
	<details class="group rounded-lg border border-gray-200 dark:border-gray-700">
		<summary class="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
			<span>📱 QR / Barcode</span>
			<svg class="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</summary>
		<div class="space-y-2 border-t border-gray-100 dark:border-gray-700 p-3">
			<div>
				<label for="qr-data-column" class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Data Column</label>
				<select id="qr-data-column" bind:value={selectedColumn} class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 text-xs">
					<option value="">Select column...</option>
					{#each headers as header}
						<option value={header}>{header}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="qr-code-type" class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
				<select id="qr-code-type" bind:value={codeType} class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 text-xs">
					<option value="qr">QR Code</option>
					<option value="barcode">Barcode</option>
				</select>
			</div>

			{#if codeType === 'barcode'}
				<div>
					<label for="barcode-format" class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Format</label>
					<select id="barcode-format" bind:value={barcodeFormat} class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 text-xs">
						<option value="CODE128">CODE128</option>
						<option value="CODE39">CODE39</option>
						<option value="EAN13">EAN-13</option>
						<option value="EAN8">EAN-8</option>
						<option value="UPC">UPC-A</option>
						<option value="ITF14">ITF-14</option>
					</select>
				</div>
			{/if}

			<button
				onclick={addCode}
				disabled={!selectedColumn}
				class="w-full cursor-pointer rounded bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Add {codeType === 'qr' ? 'QR Code' : 'Barcode'}
			</button>
		</div>
	</details>
{/if}
