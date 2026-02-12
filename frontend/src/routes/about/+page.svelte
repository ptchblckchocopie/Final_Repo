<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>About - Veent</title>
</svelte:head>

<!-- Hero Header -->
<section class="relative overflow-hidden bg-slate-900 py-24 text-white">
	<div class="absolute inset-0 bg-gradient-to-br from-indigo-600/15 via-transparent to-purple-600/10"></div>
	<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<p class="mb-4 text-sm font-semibold uppercase tracking-wider text-indigo-400">Who we are</p>
			<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">About Veent</h1>
			<p class="mt-6 text-lg leading-relaxed text-gray-400">
				Professional event ticketing tools built for speed and simplicity.
			</p>
		</div>
	</div>
</section>

<!-- Posts Section -->
<section class="bg-white py-20">
	<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
		<div class="mb-12 text-center">
			<p class="text-sm font-semibold uppercase tracking-wider text-indigo-600">Updates</p>
			<h2 class="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Latest Posts</h2>
		</div>

		{#if data.posts.length > 0}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.posts as post}
					<article class="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
						<div class="h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
						<div class="p-6">
							<h3 class="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{post.title}</h3>
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
