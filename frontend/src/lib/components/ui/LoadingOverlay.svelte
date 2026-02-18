<script lang="ts">
	interface Props {
		visible: boolean;
		message?: string;
		progress?: number;
	}

	const { visible, message = 'Processing...', progress = -1 }: Props = $props();
</script>

{#if visible}
	<div class="fixed inset-0 z-[9997] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
		<div class="w-80 rounded-xl bg-white dark:bg-gray-800 p-8 text-center shadow-2xl">
			<div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-red-200 dark:border-red-800 border-t-red-600"></div>
			<p class="mb-3 font-medium text-gray-700 dark:text-gray-200">{message}</p>
			{#if progress >= 0}
				<div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
					<div
						class="h-full rounded-full bg-red-600 transition-all duration-300"
						style="width: {Math.min(progress, 100)}%"
					></div>
				</div>
				<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{Math.round(progress)}%</p>
			{/if}
		</div>
	</div>
{/if}
