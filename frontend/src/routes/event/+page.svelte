<script lang="ts">
	let { data } = $props();

	let localEvents = $state<typeof data.event | null>(null);
	const events = $derived(localEvents ?? data.event);

	let title = $state('');
	let content = $state('');
	let event_date = $state('');
	let submitting = $state(false);

	async function addEvent() {
		submitting = true;
		try {
			const res = await fetch('/api/event', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, content, event_date })
			});

			if (res.ok) {
				title = '';
				content = '';
				event_date = '';

				const listRes = await fetch('/api/event');
				if (listRes.ok) {
					const json = await listRes.json();
					localEvents = json.docs;
				}
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Events - Veent</title>
</svelte:head>

<!-- Hero Header -->
<section class="relative overflow-hidden bg-slate-900 py-24 text-white">
	<div class="absolute inset-0 bg-gradient-to-br from-indigo-600/15 via-transparent to-purple-600/10"></div>
	<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<p class="mb-4 text-sm font-semibold uppercase tracking-wider text-indigo-400">Manage</p>
			<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">Events</h1>
			<p class="mt-6 text-lg leading-relaxed text-gray-400">
				Create and manage your upcoming events.
			</p>
		</div>
	</div>
</section>

<!-- Content -->
<section class="bg-white py-20">
	<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
		<div class="grid gap-12 lg:grid-cols-5">
			<!-- Add Event Form -->
			<div class="lg:col-span-2">
				<div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
					<h2 class="mb-6 text-xl font-bold text-gray-900">Add Event</h2>
					<form onsubmit={(e) => { e.preventDefault(); addEvent(); }} class="space-y-5">
						<div>
							<label for="event-title" class="mb-2 block text-sm font-medium text-gray-700">Title</label>
							<input
								id="event-title"
								type="text"
								bind:value={title}
								required
								class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
								placeholder="Event title"
							/>
						</div>

						<div>
							<label for="event-content" class="mb-2 block text-sm font-medium text-gray-700">Description</label>
							<textarea
								id="event-content"
								bind:value={content}
								required
								rows="4"
								class="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
								placeholder="What's this event about?"
							></textarea>
						</div>

						<div>
							<label for="event-date" class="mb-2 block text-sm font-medium text-gray-700">Event Date</label>
							<input
								id="event-date"
								type="date"
								bind:value={event_date}
								required
								class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
							/>
						</div>

						<button
							type="submit"
							disabled={submitting}
							class="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if submitting}
								<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Adding...
							{:else}
								Add Event
								<svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
								</svg>
							{/if}
						</button>
					</form>
				</div>
			</div>

			<!-- Events List -->
			<div class="lg:col-span-3">
				<h2 class="mb-6 text-xl font-bold text-gray-900">Upcoming Events</h2>
				{#if events.length > 0}
					<div class="space-y-4">
						{#each events as event}
							<div class="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
								<div class="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
								<div class="p-6">
									<div class="flex items-start justify-between gap-4">
										<div class="min-w-0 flex-1">
											<h3 class="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{event.title}</h3>
											<p class="mt-2 text-sm leading-relaxed text-gray-500">{event.content}</p>
										</div>
										{#if event.event_date}
											<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
												</svg>
												{event.event_date}
											</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
						<svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<p class="mt-4 text-gray-500">No events yet. Create one using the form.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
