<script lang="ts">
	import type { QrElement, BarcodeFormat } from '$lib/types/ticket';
	import { updateElement } from '$lib/stores/elements.svelte';
	import { getCsvHeaders } from '$lib/stores/csv.svelte';
	import { pushState } from '$lib/stores/history.svelte';

	interface Props {
		element: QrElement;
	}

	const { element }: Props = $props();
	const headers = $derived(getCsvHeaders());

	function update(updates: Partial<QrElement>) {
		pushState();
		updateElement(element.id, updates);
	}

	function updateSettings(updates: Partial<QrElement['codeSettings']>) {
		update({ codeSettings: { ...element.codeSettings, ...updates } });
	}

	function handleLogoUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (ev) => {
			updateSettings({ customLogo: ev.target?.result as string });
		};
		reader.readAsDataURL(file);
	}

	function removeLogo() {
		updateSettings({ customLogo: undefined });
	}
</script>

<div class="space-y-3">
	<!-- Data Column -->
	<div>
		<label for="qr-placeholder" class="mb-1 block text-xs font-medium text-gray-500">Data Column</label>
		<select id="qr-placeholder" value={element.placeholder} onchange={(e) => update({ placeholder: (e.target as HTMLSelectElement).value })} class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
			{#each headers as header}
				<option value={header}>{header}</option>
			{/each}
		</select>
	</div>

	<!-- Code Type -->
	<div>
		<label for="qr-type" class="mb-1 block text-xs font-medium text-gray-500">Type</label>
		<select id="qr-type" value={element.codeSettings.codeType} onchange={(e) => updateSettings({ codeType: (e.target as HTMLSelectElement).value as any })} class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
			<option value="qr">QR Code</option>
			<option value="barcode">Barcode</option>
		</select>
	</div>

	{#if element.codeSettings.codeType === 'barcode'}
		<div>
			<label for="qr-barcode-format" class="mb-1 block text-xs font-medium text-gray-500">Barcode Format</label>
			<select id="qr-barcode-format" value={element.codeSettings.barcodeType || 'CODE128'} onchange={(e) => updateSettings({ barcodeType: (e.target as HTMLSelectElement).value as BarcodeFormat })} class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
				<option value="CODE128">CODE128</option>
				<option value="CODE39">CODE39</option>
				<option value="EAN13">EAN-13</option>
				<option value="EAN8">EAN-8</option>
				<option value="UPC">UPC-A</option>
				<option value="ITF14">ITF-14</option>
			</select>
		</div>
	{/if}

	<!-- QR Logo -->
	{#if element.codeSettings.codeType === 'qr'}
		<div>
			<label for="qr-logo-upload" class="mb-1 block text-xs font-medium text-gray-500">Logo Overlay</label>
			{#if element.codeSettings.customLogo}
				<div class="flex items-center gap-2 rounded border border-gray-200 p-2">
					<img src={element.codeSettings.customLogo} alt="Logo" class="h-8 w-8 rounded object-contain" />
					<span class="flex-1 truncate text-xs text-gray-500">Logo set</span>
					<button onclick={removeLogo} class="cursor-pointer rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Remove</button>
				</div>
			{:else}
				<input id="qr-logo-upload" type="file" accept="image/*" onchange={handleLogoUpload} class="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 file:cursor-pointer hover:file:bg-indigo-100" />
				<p class="mt-1 text-xs text-gray-400">Overlays a logo in the center of the QR code</p>
			{/if}
		</div>
	{/if}

	<!-- Colors -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label for="qr-bg-color" class="mb-1 block text-xs font-medium text-gray-500">Background</label>
			<input id="qr-bg-color" type="color" value={element.codeSettings.background} onchange={(e) => updateSettings({ background: (e.target as HTMLInputElement).value })} class="h-8 w-full cursor-pointer rounded border-0" />
		</div>
		<div class="flex-1">
			<label for="qr-fg-color" class="mb-1 block text-xs font-medium text-gray-500">Foreground</label>
			<input id="qr-fg-color" type="color" value={element.codeSettings.foreground} onchange={(e) => updateSettings({ foreground: (e.target as HTMLInputElement).value })} class="h-8 w-full cursor-pointer rounded border-0" />
		</div>
	</div>

	<!-- Rotation -->
	<div>
		<label for="qr-rotation" class="mb-1 block text-xs font-medium text-gray-500">Rotation ({element.rotation}°)</label>
		<input id="qr-rotation" type="range" min="0" max="359" value={element.rotation} oninput={(e) => update({ rotation: parseInt((e.target as HTMLInputElement).value) })} class="w-full" />
	</div>

	<!-- Size -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label for="qr-width" class="mb-1 block text-xs font-medium text-gray-500">Width</label>
			<input id="qr-width" type="number" value={element.size.width} onchange={(e) => update({ size: { ...element.size, width: Math.max(20, parseInt((e.target as HTMLInputElement).value) || 80) } })} min="20" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
		<div class="flex-1">
			<label for="qr-height" class="mb-1 block text-xs font-medium text-gray-500">Height</label>
			<input id="qr-height" type="number" value={element.size.height} onchange={(e) => update({ size: { ...element.size, height: Math.max(20, parseInt((e.target as HTMLInputElement).value) || 80) } })} min="20" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
	</div>

	<!-- Position -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label for="qr-pos-x" class="mb-1 block text-xs font-medium text-gray-500">X</label>
			<input id="qr-pos-x" type="number" value={Math.round(element.position.x)} onchange={(e) => update({ position: { ...element.position, x: parseInt((e.target as HTMLInputElement).value) || 0 } })} class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
		<div class="flex-1">
			<label for="qr-pos-y" class="mb-1 block text-xs font-medium text-gray-500">Y</label>
			<input id="qr-pos-y" type="number" value={Math.round(element.position.y)} onchange={(e) => update({ position: { ...element.position, y: parseInt((e.target as HTMLInputElement).value) || 0 } })} class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
	</div>
</div>
