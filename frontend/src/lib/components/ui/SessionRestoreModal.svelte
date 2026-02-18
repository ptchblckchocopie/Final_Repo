<script lang="ts">
	import Modal from './Modal.svelte';

	interface Props {
		open: boolean;
		savedAt: string | null;
		onrestore: () => void;
		ondiscard: () => void;
	}

	const { open, savedAt, onrestore, ondiscard }: Props = $props();

	function formatTime(iso: string | null): string {
		if (!iso) return 'unknown time';
		try {
			const date = new Date(iso);
			return date.toLocaleString();
		} catch {
			return 'unknown time';
		}
	}
</script>

<Modal {open} title="Resume Previous Session?" onclose={ondiscard}>
	<div class="space-y-4">
		<p class="text-sm text-gray-600 dark:text-gray-300">
			A previous session was found from <strong>{formatTime(savedAt)}</strong>. Would you like to restore it?
		</p>
		<div class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3">
			<p class="text-xs text-red-700 dark:text-red-300">
				Restoring will load your previous elements, CSV data, background image, and settings.
			</p>
		</div>
		<div class="flex justify-end gap-2">
			<button
				onclick={ondiscard}
				class="cursor-pointer rounded-lg px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
			>
				Discard
			</button>
			<button
				onclick={onrestore}
				class="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
			>
				Restore
			</button>
		</div>
	</div>
</Modal>
