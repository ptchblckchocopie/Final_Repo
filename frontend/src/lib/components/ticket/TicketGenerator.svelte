<script lang="ts">
	import DesignTab from './DesignTab.svelte';
	import PreviewTab from './PreviewTab.svelte';
	import PngExportTab from './PngExportTab.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { getIsDark } from '$lib/stores/theme.svelte';

	let activeTab = $state<'design' | 'preview' | 'export'>('design');

	const isDark = $derived(getIsDark());

	const tabs = [
		{ id: 'design' as const, label: 'Design', icon: '🎨' },
		{ id: 'preview' as const, label: 'Printable Preview', icon: '🖨️' },
		{ id: 'export' as const, label: 'Export as PNGs', icon: '📦' }
	];
</script>

<div class="flex h-[calc(100vh-4rem)] flex-col bg-gray-100 dark:bg-gray-900" class:dark={isDark}>
	<!-- Tab Bar -->
	<div class="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
		{#each tabs as tab}
			<button
				onclick={() => (activeTab = tab.id)}
				class="flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === tab.id
					? 'border-red-600 text-red-600 dark:text-red-400 dark:border-red-400'
					: 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200'}"
			>
				<span>{tab.icon}</span>
				<span class="hidden sm:inline">{tab.label}</span>
			</button>
		{/each}

		<ThemeToggle />
	</div>

	<!-- Tab Content -->
	<div class="min-h-0 flex-1">
		{#if activeTab === 'design'}
			<DesignTab />
		{:else if activeTab === 'preview'}
			<PreviewTab />
		{:else}
			<PngExportTab />
		{/if}
	</div>
</div>
