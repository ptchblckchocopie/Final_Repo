<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	const PAYLOAD_URL = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';

	let { data } = $props();

	let searchInput = $state(data.search || '');
	let searchTimeout: ReturnType<typeof setTimeout>;

	const activeSort = $derived(data.sort || 'nearest');

	// Toast notification state
	let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout>;

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		clearTimeout(toastTimeout);
		toast = { message, type };
		toastTimeout = setTimeout(() => { toast = null; }, 3000);
	}

	// Modal state
	let showCreateModal = $state(false);
	let submitting = $state(false);

	// Form fields
	let newTitle = $state('');
	let newSlug = $state('');
	let slugManuallyEdited = $state(false);
	let newContent = $state('');
	let newStartDate = $state('');
	let newStartTime = $state('');
	let newEndDate = $state('');
	let newEndTime = $state('');
	let newLocation = $state('');

	// File states
	let companyLogoFile = $state<File | null>(null);
	let posterFile = $state<File | null>(null);
	let backgroundFile = $state<File | null>(null);

	// Preview URLs
	let companyLogoPreview = $state<string | null>(null);
	let posterPreview = $state<string | null>(null);
	let backgroundPreview = $state<string | null>(null);

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			const params = new URLSearchParams();
			if (searchInput.trim()) params.set('search', searchInput.trim());
			if (activeSort !== 'nearest') params.set('sort', activeSort);
			const qs = params.toString();
			goto(`/event${qs ? `?${qs}` : ''}`, { keepFocus: true });
		}, 400);
	}

	function setSort(sort: string) {
		const params = new URLSearchParams();
		if (searchInput.trim()) params.set('search', searchInput.trim());
		if (sort !== 'nearest') params.set('sort', sort);
		const qs = params.toString();
		goto(`/event${qs ? `?${qs}` : ''}`);
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getPosterUrl(event: any): string | null {
		if (!event.poster) return null;
		if (typeof event.poster === 'string') return null;
		return event.poster.url || null;
	}

	function slugify(text: string): string {
		return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	}

	function handleTitleInput() {
		if (!slugManuallyEdited) {
			newSlug = slugify(newTitle);
		}
	}

	function handleSlugInput() {
		slugManuallyEdited = true;
	}

	// Modal helpers
	function openModal() {
		showCreateModal = true;
	}

	function closeModal() {
		showCreateModal = false;
		resetForm();
	}

	function resetForm() {
		newTitle = '';
		newSlug = '';
		slugManuallyEdited = false;
		newContent = '';
		newStartDate = '';
		newStartTime = '';
		newEndDate = '';
		newEndTime = '';
		newLocation = '';
		setFilePreview('companyLogo', null);
		setFilePreview('poster', null);
		setFilePreview('background', null);
	}

	function setFilePreview(type: 'companyLogo' | 'poster' | 'background', file: File | null) {
		if (type === 'companyLogo') {
			if (companyLogoPreview) URL.revokeObjectURL(companyLogoPreview);
			companyLogoFile = file;
			companyLogoPreview = file ? URL.createObjectURL(file) : null;
		} else if (type === 'poster') {
			if (posterPreview) URL.revokeObjectURL(posterPreview);
			posterFile = file;
			posterPreview = file ? URL.createObjectURL(file) : null;
		} else {
			if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
			backgroundFile = file;
			backgroundPreview = file ? URL.createObjectURL(file) : null;
		}
	}

	function handleFileInput(type: 'companyLogo' | 'poster' | 'background', event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		setFilePreview(type, file);
	}

	async function uploadMedia(file: File, altText: string): Promise<number> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('_payload', JSON.stringify({ alt: altText }));

		const res = await fetch(`${PAYLOAD_URL}/api/media`, {
			method: 'POST',
			body: formData
		});

		if (!res.ok) {
			const errorBody = await res.text().catch(() => '');
			throw new Error(`Media upload failed: ${res.status} - ${errorBody}`);
		}

		const data = await res.json();
		return data.doc.id;
	}

	async function handleSubmit() {
		if (!newTitle.trim() || !newStartDate || !newSlug.trim()) {
			alert('Please fill in the event title, slug, and start date.');
			return;
		}

		submitting = true;

		try {
			// Upload media files in parallel
			const [companyLogoId, posterId, backgroundId] = await Promise.all([
				companyLogoFile ? uploadMedia(companyLogoFile, `Logo: ${newTitle}`) : Promise.resolve(null),
				posterFile ? uploadMedia(posterFile, `Poster: ${newTitle}`) : Promise.resolve(null),
				backgroundFile ? uploadMedia(backgroundFile, `Background: ${newTitle}`) : Promise.resolve(null)
			]);

			// Build event payload
			const eventData: Record<string, any> = {
				title: newTitle.trim(),
				slug: newSlug.trim(),
				content: newContent.trim(),
				event_date: newStartDate
			};

			if (newStartTime) eventData.start_time = newStartTime;
			if (newEndDate) eventData.end_date = newEndDate;
			if (newEndTime) eventData.end_time = newEndTime;
			if (newLocation.trim()) eventData.location = newLocation.trim();
			if (companyLogoId) eventData.company_logo = companyLogoId;
			if (posterId) eventData.poster = posterId;
			if (backgroundId) eventData.background_image = backgroundId;

			const res = await fetch(`${PAYLOAD_URL}/api/event`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(eventData)
			});

			if (!res.ok) {
				const errorBody = await res.text().catch(() => '');
				throw new Error(`Failed to create event: ${res.status} - ${errorBody}`);
			}

			closeModal();
			await invalidateAll();
			showToast('Event created successfully!');
		} catch (err: any) {
			showToast(err.message || 'Failed to create event.', 'error');
		} finally {
			submitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showCreateModal) {
			closeModal();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Events - Veent</title>
</svelte:head>

<div class="dark min-h-screen bg-[#060a14] text-white">
	<!-- Aurora background -->
	<div class="aurora-bg">
		<div class="aurora-layer-1"></div>
		<div class="aurora-layer-2"></div>
	</div>

	<!-- Hero Section -->
	<section class="relative overflow-hidden pt-24 pb-12">
		<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-3xl text-center fade-slide-up">
				<p class="mb-4 text-sm font-semibold uppercase tracking-wider text-indigo-400">Discover</p>
				<h1 class="gradient-text text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
					Events
				</h1>
				<p class="mt-6 text-lg leading-relaxed text-gray-400">
					Browse and manage your upcoming events
				</p>
			</div>
		</div>
	</section>

	<!-- Controls Bar -->
	<section class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
		<div class="glass-card rounded-2xl p-4 sm:p-6 fade-slide-up" style="animation-delay: 0.1s;">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<!-- Search Input -->
				<div class="relative flex-1 max-w-md">
					<svg class="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder="Search events..."
						bind:value={searchInput}
						oninput={handleSearch}
						class="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pr-4 pl-10 text-sm text-white placeholder-gray-500 transition-all focus:border-indigo-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
					/>
				</div>

				<div class="flex items-center gap-3">
					<!-- Sort Toggle -->
					<div class="flex rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
						<button
							onclick={() => setSort('nearest')}
							class="rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all {activeSort === 'nearest'
								? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
								: 'text-gray-400 hover:text-white'}"
						>
							Nearest
						</button>
						<button
							onclick={() => setSort('farthest')}
							class="rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all {activeSort === 'farthest'
								? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
								: 'text-gray-400 hover:text-white'}"
						>
							Farthest
						</button>
					</div>

					<!-- Create Event Button -->
					<button
						onclick={openModal}
						class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						Create Event
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Event Grid -->
	<section class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
		{#if data.event.length > 0}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.event as event, i}
					<a
						href="/event/{event.slug}"
						class="event-card glass-card group block overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.15] hover:shadow-2xl hover:shadow-indigo-500/10 no-underline"
						style="animation-delay: {0.15 + i * 0.06}s;"
					>
						<!-- Poster Image -->
						<div class="relative aspect-[16/10] overflow-hidden">
							{#if getPosterUrl(event)}
								<img
									src={getPosterUrl(event)}
									alt={event.title}
									class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
								/>
								<div class="absolute inset-0 bg-gradient-to-t from-[#060a14] via-transparent to-transparent"></div>
							{:else}
								<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-600/20 via-violet-600/15 to-purple-600/20">
									<svg class="h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
								<div class="absolute inset-0 bg-gradient-to-t from-[#060a14] via-transparent to-transparent"></div>
							{/if}
						</div>

						<!-- Card Content -->
						<div class="p-5">
							<h3 class="text-lg font-bold text-white transition-colors group-hover:text-indigo-300">
								{event.title}
							</h3>
							{#if event.event_date}
								<div class="mt-3 flex items-center gap-2 text-sm text-gray-400">
									<svg class="h-4 w-4 text-indigo-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									{formatDate(event.event_date)}
								</div>
							{/if}
							{#if event.content}
								<p class="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-500">
									{event.content}
								</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<!-- Empty State -->
			<div class="glass-card mx-auto max-w-md rounded-2xl p-16 text-center fade-slide-up" style="animation-delay: 0.2s;">
				<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10">
					<svg class="h-8 w-8 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				</div>
				<p class="mt-6 text-gray-400">
					{#if data.search}
						No events match "<span class="text-indigo-400">{data.search}</span>"
					{:else}
						No events yet
					{/if}
				</p>
			</div>
		{/if}
	</section>
</div>

<!-- Toast Notification -->
{#if toast}
	<div class="fixed bottom-6 right-6 z-[60] toast-enter">
		<div class="flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl {toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}">
			{#if toast.type === 'success'}
				<svg class="h-5 w-5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			{:else}
				<svg class="h-5 w-5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
				</svg>
			{/if}
			<span class="text-sm font-medium text-white">{toast.message}</span>
			<button
				onclick={() => toast = null}
				class="ml-2 text-white/70 hover:text-white transition-colors"
				aria-label="Dismiss"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}

<!-- Create Event Modal -->
{#if showCreateModal}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Create Event"
	>
		<!-- Modal Container -->
		<div class="modal-enter glass-card relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8">
			<!-- Close Button -->
			<button
				onclick={closeModal}
				class="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
				aria-label="Close"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Header -->
			<h2 class="text-xl font-bold text-white mb-6">Create Event</h2>

			<!-- Section 1: Event Details -->
			<div class="space-y-4">
				<h3 class="text-sm font-semibold uppercase tracking-wider text-indigo-400">Event Details</h3>

				<!-- Title -->
				<div>
					<label for="event-title" class="block text-sm font-medium text-gray-300 mb-1.5">Title <span class="text-red-400">*</span></label>
					<input
						id="event-title"
						type="text"
						bind:value={newTitle}
						oninput={handleTitleInput}
						placeholder="Enter event title"
						class="modal-input"
					/>
				</div>

				<!-- Slug -->
				<div>
					<label for="event-slug" class="block text-sm font-medium text-gray-300 mb-1.5">Slug <span class="text-red-400">*</span></label>
					<input
						id="event-slug"
						type="text"
						bind:value={newSlug}
						oninput={handleSlugInput}
						placeholder="url-friendly-slug"
						class="modal-input font-mono text-xs"
					/>
					<p class="mt-1 text-xs text-gray-500">Auto-generated from title. Used in the event URL.</p>
				</div>

				<!-- Start Date + Time Row -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="event-start-date" class="block text-sm font-medium text-gray-300 mb-1.5">Start Date <span class="text-red-400">*</span></label>
						<input
							id="event-start-date"
							type="date"
							bind:value={newStartDate}
							class="modal-input"
						/>
					</div>
					<div>
						<label for="event-start-time" class="block text-sm font-medium text-gray-300 mb-1.5">Start Time</label>
						<input
							id="event-start-time"
							type="time"
							bind:value={newStartTime}
							class="modal-input"
						/>
					</div>
				</div>

				<!-- End Date + Time Row -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="event-end-date" class="block text-sm font-medium text-gray-300 mb-1.5">End Date</label>
						<input
							id="event-end-date"
							type="date"
							bind:value={newEndDate}
							class="modal-input"
						/>
					</div>
					<div>
						<label for="event-end-time" class="block text-sm font-medium text-gray-300 mb-1.5">End Time</label>
						<input
							id="event-end-time"
							type="time"
							bind:value={newEndTime}
							class="modal-input"
						/>
					</div>
				</div>

				<!-- Location -->
				<div>
					<label for="event-location" class="block text-sm font-medium text-gray-300 mb-1.5">Location</label>
					<input
						id="event-location"
						type="text"
						bind:value={newLocation}
						placeholder="Enter event location"
						class="modal-input"
					/>
				</div>

				<!-- Description -->
				<div>
					<label for="event-description" class="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
					<textarea
						id="event-description"
						bind:value={newContent}
						placeholder="Describe your event..."
						rows="3"
						class="modal-input resize-none"
					></textarea>
				</div>
			</div>

			<!-- Section 2: Event Media -->
			<div class="mt-6 space-y-4">
				<h3 class="text-sm font-semibold uppercase tracking-wider text-indigo-400">Event Media</h3>

				<div class="grid grid-cols-3 gap-3">
					<!-- Company Logo Upload -->
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-1.5">Company Logo</label>
						<div class="upload-zone">
							{#if companyLogoPreview}
								<div class="relative h-full">
									<img src={companyLogoPreview} alt="Logo preview" class="h-full w-full rounded-lg object-contain" />
									<button
										onclick={() => setFilePreview('companyLogo', null)}
										class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-lg hover:bg-red-400"
										aria-label="Remove logo"
									>
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{:else}
								<label class="flex h-full cursor-pointer flex-col items-center justify-center gap-1.5 text-center">
									<svg class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span class="text-xs text-gray-500">Upload Logo</span>
									<input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileInput('companyLogo', e)} />
								</label>
							{/if}
						</div>
					</div>

					<!-- Event Poster Upload -->
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-1.5">Event Poster</label>
						<div class="upload-zone">
							{#if posterPreview}
								<div class="relative h-full">
									<img src={posterPreview} alt="Poster preview" class="h-full w-full rounded-lg object-contain" />
									<button
										onclick={() => setFilePreview('poster', null)}
										class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-lg hover:bg-red-400"
										aria-label="Remove poster"
									>
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{:else}
								<label class="flex h-full cursor-pointer flex-col items-center justify-center gap-1.5 text-center">
									<svg class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
									</svg>
									<span class="text-xs text-gray-500">Upload Poster</span>
									<input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileInput('poster', e)} />
								</label>
							{/if}
						</div>
					</div>

					<!-- Background Image Upload -->
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-1.5">Background</label>
						<div class="upload-zone">
							{#if backgroundPreview}
								<div class="relative h-full">
									<img src={backgroundPreview} alt="Background preview" class="h-full w-full rounded-lg object-cover" />
									<button
										onclick={() => setFilePreview('background', null)}
										class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-lg hover:bg-red-400"
										aria-label="Remove background"
									>
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{:else}
								<label class="flex h-full cursor-pointer flex-col items-center justify-center gap-1.5 text-center">
									<svg class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
									</svg>
									<span class="text-xs text-gray-500">Upload Background</span>
									<input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileInput('background', e)} />
								</label>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="mt-8 flex items-center justify-end gap-3">
				<button
					onclick={closeModal}
					disabled={submitting}
					class="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-gray-300 transition-all hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={handleSubmit}
					disabled={submitting}
					class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if submitting}
						<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
						Creating...
					{:else}
						Create Event
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Toast animation */
	.toast-enter {
		animation: toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Aurora background */
	.aurora-bg {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.aurora-layer-1 {
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: conic-gradient(
			from 0deg at 50% 50%,
			rgba(99, 102, 241, 0.08) 0deg,
			transparent 60deg,
			rgba(139, 92, 246, 0.06) 120deg,
			transparent 180deg,
			rgba(99, 102, 241, 0.08) 240deg,
			transparent 300deg,
			rgba(139, 92, 246, 0.06) 360deg
		);
		animation: auroraRotate 35s linear infinite;
	}

	.aurora-layer-2 {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.06) 0%, transparent 50%),
			radial-gradient(ellipse at 80% 50%, rgba(139, 92, 246, 0.04) 0%, transparent 50%);
		animation: auroraPulse 10s ease-in-out infinite;
	}

	@keyframes auroraRotate {
		to { transform: rotate(360deg); }
	}

	@keyframes auroraPulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.05); }
	}

	/* Glass card */
	.glass-card {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(24px);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.35),
			0 2px 8px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	/* Gradient text */
	.gradient-text {
		background: linear-gradient(135deg, #a5b4fc, #c4b5fd, #a5b4fc);
		background-size: 200% 200%;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		animation: gradientShift 6s ease-in-out infinite;
	}

	@keyframes gradientShift {
		0%, 100% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
	}

	/* Fade slide up animation */
	.fade-slide-up {
		animation: fadeSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.event-card {
		animation: fadeSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes fadeSlideUp {
		from {
			opacity: 0;
			transform: translateY(24px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Line clamp utility */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Modal entrance animation */
	.modal-enter {
		animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes modalIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	/* Modal form inputs */
	.modal-input {
		width: 100%;
		border-radius: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		padding: 0.625rem 0.875rem;
		font-size: 0.875rem;
		color: white;
		transition: all 0.15s;
	}

	.modal-input::placeholder {
		color: rgb(107, 114, 128);
	}

	.modal-input:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
		background: rgba(255, 255, 255, 0.06);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
	}

	/* Upload zones */
	.upload-zone {
		aspect-ratio: 1;
		border-radius: 0.75rem;
		border: 2px dashed rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.02);
		transition: all 0.15s;
		padding: 0.5rem;
	}

	.upload-zone:hover {
		border-color: rgba(99, 102, 241, 0.3);
		background: rgba(99, 102, 241, 0.05);
	}
</style>
