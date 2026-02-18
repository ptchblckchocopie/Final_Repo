<script lang="ts">
	import { page } from '$app/stores';
	import MobileMenu from './MobileMenu.svelte';

	const navLinks = [
		{ href: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
		{ href: '/about', label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
		{ href: '/contact', label: 'Contact Us', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
		{ href: '/ticket-generator', label: 'Ticket Generator', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z', highlight: true },
		{ href: '/dev-chat', label: 'Dev Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
		{ href: '/event', label: 'Events', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
		{ href: '/event-calendar', label: 'Calendar', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z' },
		{ href: '/snake-game', label: 'Snake Game', icon: 'M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z' }
	];

	let mobileOpen = $state(false);

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<nav class="fixed top-0 right-0 left-0 z-50 bg-gradient-to-r from-slate-900 via-slate-900 to-red-950 shadow-lg shadow-black/10">
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Logo -->
		<a href="/" class="group flex items-center gap-2.5">
			<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-sm font-extrabold text-white shadow-md shadow-red-500/30 transition-shadow group-hover:shadow-lg group-hover:shadow-red-500/40">V</span>
			<span class="text-lg font-bold tracking-tight text-white">Veent Tix</span>
		</a>

		<!-- Desktop Navigation -->
		<div class="hidden items-center gap-0.5 md:flex">
			{#each navLinks as link}
				{@const active = isActive(link.href, $page.url.pathname)}
				<a
					href={link.href}
					class="group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
					{active
						? link.highlight
							? 'bg-red-600 text-white shadow-md shadow-red-600/30'
							: 'bg-white/10 text-white'
						: link.highlight
							? 'text-red-300 hover:bg-red-600/80 hover:text-white hover:shadow-md hover:shadow-red-600/20'
							: 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}"
				>
					<svg class="h-4 w-4 {active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d={link.icon} />
					</svg>
					{link.label}
					{#if active && !link.highlight}
						<span class="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-red-400"></span>
					{/if}
				</a>
			{/each}
		</div>

		<!-- Mobile Menu Button -->
		<button
			onclick={() => (mobileOpen = !mobileOpen)}
			class="relative cursor-pointer rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white md:hidden"
			aria-label="Toggle menu"
		>
			<svg class="h-6 w-6 transition-transform duration-200 {mobileOpen ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				{#if mobileOpen}
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				{:else}
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				{/if}
			</svg>
		</button>
	</div>

	<!-- Mobile Menu -->
	<MobileMenu open={mobileOpen} {navLinks} onclose={() => (mobileOpen = false)} />
</nav>
