<script lang="ts">
	import Navbar from '$lib/components/layout/Navbar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import '../app.css';

	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const isTicketGenerator = $derived($page.url.pathname === '/ticket-generator');
</script>

<div class="flex min-h-screen flex-col bg-gray-50">
	<Navbar />
	<main class="pt-16 flex-1">
		{@render children()}
	</main>
	{#if !isTicketGenerator}
		<Footer />
	{/if}
	<ToastContainer />
</div>
