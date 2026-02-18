<script lang="ts">
	import { page } from '$app/stores';

	interface NavLink {
		href: string;
		label: string;
		icon: string;
		highlight?: boolean;
	}

	interface Props {
		open: boolean;
		navLinks: NavLink[];
		onclose: () => void;
	}

	const { open, navLinks, onclose }: Props = $props();

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 top-16 z-40 bg-black/40 backdrop-blur-sm md:hidden" onclick={onclose} onkeydown={() => {}}></div>

	<!-- Menu Panel -->
	<div class="fixed top-16 right-0 left-0 z-50 border-t border-white/5 bg-slate-900 shadow-2xl md:hidden">
		<div class="space-y-1 px-3 py-4">
			{#each navLinks as link}
				{@const active = isActive(link.href, $page.url.pathname)}
				<a
					href={link.href}
					onclick={onclose}
					class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all
					{active
						? link.highlight
							? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
							: 'bg-white/10 text-white'
						: 'text-gray-400 hover:bg-white/5 hover:text-white'}"
				>
					<svg class="h-5 w-5 {active ? 'opacity-100' : 'opacity-50'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d={link.icon} />
					</svg>
					{link.label}
				</a>
			{/each}
		</div>
	</div>
{/if}
