<script lang="ts">
	import { loadCSV, getCsvHeaders } from '$lib/stores/csv.svelte';
	import { setBackgroundImage, getBackgroundImage, setBackgroundFitMode, getBackgroundFitMode } from '$lib/stores/canvas.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { BackgroundFitMode } from '$lib/types/ticket';

	const headers = $derived(getCsvHeaders());
	const hasBackground = $derived(getBackgroundImage() !== null);
	const fitMode = $derived(getBackgroundFitMode());

	function handleCSVFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			showToast('error', 'File too large', 'CSV must be under 5MB');
			return;
		}

		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				loadCSV(ev.target?.result as string);
				showToast('success', 'CSV loaded', `${headers.length} columns found`);
			} catch (err) {
				showToast('error', 'CSV error', (err as Error).message);
			}
		};
		reader.readAsText(file);
	}

	function handleBackgroundFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// SEC-H7: Validate file size and type before reading
		if (file.size > 10 * 1024 * 1024) {
			showToast('error', 'File too large', 'Image must be under 10MB');
			return;
		}

		if (!file.type.startsWith('image/')) {
			showToast('error', 'Invalid file type', 'Please select an image file');
			return;
		}

		const reader = new FileReader();
		reader.onload = (ev) => {
			setBackgroundImage(ev.target?.result as string);
			showToast('success', 'Background set');
		};
		reader.readAsDataURL(file);
	}

	function clearBackground() {
		setBackgroundImage(null);
	}

	function handleFitMode(e: Event) {
		setBackgroundFitMode((e.target as HTMLSelectElement).value as BackgroundFitMode);
	}
</script>

<details class="group rounded-lg border border-gray-200 dark:border-gray-700" open>
	<summary class="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
		<span>📁 Files</span>
		<svg class="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</summary>
	<div class="space-y-3 border-t border-gray-100 dark:border-gray-700 p-3">
		<!-- CSV Upload -->
		<div>
			<label for="csv-upload" class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">CSV Data</label>
			<input id="csv-upload" type="file" accept=".csv" onchange={handleCSVFile} class="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-indigo-50 dark:file:bg-indigo-900/30 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 dark:file:text-indigo-300 file:cursor-pointer hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50 dark:text-gray-300" />
		</div>

		<!-- Background Upload -->
		<div>
			<label for="bg-upload" class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Background Image</label>
			<input id="bg-upload" type="file" accept="image/*" onchange={handleBackgroundFile} class="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-indigo-50 dark:file:bg-indigo-900/30 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 dark:file:text-indigo-300 file:cursor-pointer hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50 dark:text-gray-300" />
			{#if hasBackground}
				<div class="mt-2 flex items-center gap-2">
					<select id="bg-fit-mode" value={fitMode} onchange={handleFitMode} class="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 text-xs">
						<option value="cover">Cover</option>
						<option value="contain">Contain</option>
						<option value="stretch">Stretch</option>
						<option value="original">Original</option>
					</select>
					<button onclick={clearBackground} class="cursor-pointer rounded bg-red-50 dark:bg-red-900/30 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50">Remove</button>
				</div>
			{/if}
		</div>
	</div>
</details>
