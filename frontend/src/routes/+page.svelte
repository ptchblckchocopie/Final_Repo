<script lang="ts">
	import { onMount } from 'svelte';
	import type { PayloadPost, PaginatedResponse } from '$lib/types/payload';

	let posts = $state<PayloadPost[]>([]);
	let loading = $state(true);

	const features = [
		{
			icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
			title: 'Ticket Generator',
			description: 'Design professional tickets, convention IDs, and certificates from CSV data with QR codes and branding.',
			color: 'from-red-500 to-red-600'
		},
		{
			icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
			title: 'Real-time Preview',
			description: 'See your designs come to life instantly with an interactive drag-and-drop canvas editor.',
			color: 'from-red-500 to-red-600'
		},
		{
			icon: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
			title: 'Print & Export',
			description: 'Export high-quality PNGs in bulk or print with optimized A4 layouts and cut line guides.',
			color: 'from-red-500 to-red-600'
		},
		{
			icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
			title: 'Custom Templates',
			description: 'Save and reuse your designs. Start from blank presets or build your own template library.',
			color: 'from-red-500 to-red-600'
		}
	];

	const steps = [
		{ num: '1', title: 'Upload CSV', desc: 'Import your attendee data from a spreadsheet' },
		{ num: '2', title: 'Design', desc: 'Drag fields onto the canvas, add QR codes and styling' },
		{ num: '3', title: 'Export', desc: 'Print or download as high-quality PNGs in a ZIP' }
	];

	onMount(async () => {
		try {
			const res = await fetch('/api/posts?limit=6&sort=-createdAt');
			if (res.ok) {
				const data: PaginatedResponse<PayloadPost> = await res.json();
				posts = data.docs;
			}
		} catch {
			// Backend may not be running
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Veent Tix - Ticket Generator & Event Tools</title>
</svelte:head>

<!-- Hero Section -->
<section class="relative overflow-hidden bg-slate-900 text-white">
	<!-- Background decorations -->
	<div class="absolute inset-0 bg-gradient-to-br from-red-600/20 via-transparent to-red-600/10"></div>
	<div class="absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-3xl"></div>
	<div class="absolute bottom-0 right-0 h-[300px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-red-600/10 blur-3xl"></div>

	<!-- Grid pattern overlay -->
	<div class="absolute inset-0 opacity-[0.03]" style="background-image: url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>

	<div class="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<!-- Badge -->
			<div class="mb-8 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-1.5 text-sm font-medium text-red-300">
				<span class="h-1.5 w-1.5 rounded-full bg-red-400"></span>
				Open Source Event Tools
			</div>

			<h1 class="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
				Create Professional
				<span class="mt-2 block bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent">
					Event Tickets
				</span>
			</h1>
			<p class="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
				Design stunning tickets, convention IDs, and certificates.
				Import CSV data, add QR codes, and export print-ready designs in minutes.
			</p>
			<div class="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
				<a
					href="/ticket-generator"
					class="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-red-600/25 transition-all hover:shadow-2xl hover:shadow-red-600/30 hover:brightness-110"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
					</svg>
					Open Ticket Generator
					<svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
				</a>
				<a
					href="/about"
					class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-semibold text-gray-300 backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
				>
					Learn More
				</a>
			</div>
		</div>
	</div>

	<!-- Bottom fade -->
	<div class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 to-transparent"></div>
</section>

<!-- How it works -->
<section class="bg-gray-50 py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-16 text-center">
			<p class="text-sm font-semibold uppercase tracking-wider text-red-600">How it works</p>
			<h2 class="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Three simple steps</h2>
		</div>
		<div class="grid gap-8 sm:grid-cols-3">
			{#each steps as step, i}
				<div class="relative text-center">
					{#if i < steps.length - 1}
						<div class="absolute top-8 left-[60%] hidden h-0.5 w-[80%] bg-gradient-to-r from-red-300 to-transparent sm:block"></div>
					{/if}
					<div class="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-2xl font-bold text-white shadow-lg shadow-red-500/25">
						{step.num}
					</div>
					<h3 class="mb-2 text-lg font-semibold text-gray-900">{step.title}</h3>
					<p class="text-sm leading-relaxed text-gray-500">{step.desc}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="bg-white py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-16 text-center">
			<p class="text-sm font-semibold uppercase tracking-wider text-red-600">Features</p>
			<h2 class="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Everything you need for event ticketing</h2>
			<p class="mx-auto mt-4 max-w-2xl text-lg text-gray-500">Powerful tools designed for speed and simplicity.</p>
		</div>
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each features as feature}
				<div class="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/50">
					<div class="mb-5 inline-flex rounded-xl bg-gradient-to-br {feature.color} p-3 shadow-lg">
						<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d={feature.icon} />
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-gray-900">{feature.title}</h3>
					<p class="text-sm leading-relaxed text-gray-500">{feature.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Posts Section -->
<section class="bg-gray-50 py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-12 text-center">
			<p class="text-sm font-semibold uppercase tracking-wider text-red-600">Blog</p>
			<h2 class="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Latest Posts</h2>
			<p class="mt-4 text-lg text-gray-500">Updates and news from our team.</p>
		</div>

		{#if loading}
			<div class="flex justify-center py-12">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-red-200 border-t-red-600"></div>
			</div>
		{:else if posts.length > 0}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each posts as post}
					<article class="group overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
						<div class="h-2 bg-gradient-to-r from-red-500 to-red-600"></div>
						<div class="p-6">
							<time class="text-xs font-semibold uppercase tracking-wider text-red-600">
								{new Date(post.createdAt).toLocaleDateString('en-US', {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</time>
							<h3 class="mt-3 text-lg font-bold text-gray-900 group-hover:text-red-600 transition-colors">{post.title}</h3>
							<p class="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-500">{post.content}</p>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
				<svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
				</svg>
				<p class="mt-4 text-gray-500">No posts yet. Create some in the admin panel.</p>
			</div>
		{/if}
	</div>
</section>

<!-- CTA Section -->
<section class="bg-gradient-to-r from-red-600 to-red-700 py-20">
	<div class="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
		<h2 class="text-3xl font-bold text-white sm:text-4xl">Ready to create your tickets?</h2>
		<p class="mx-auto mt-4 max-w-xl text-lg text-red-100">
			Start designing professional event tickets in minutes. No sign-up required.
		</p>
		<a
			href="/ticket-generator"
			class="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-red-600 shadow-xl transition-all hover:bg-gray-50 hover:shadow-2xl"
		>
			Get Started Free
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
			</svg>
		</a>
	</div>
</section>
