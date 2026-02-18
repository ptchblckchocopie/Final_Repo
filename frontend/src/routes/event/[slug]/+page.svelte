<script lang="ts">
	import { onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	const PAYLOAD_URL = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';

	let { data } = $props();
	const event = $derived(data.event);

	// Toast notification state
	let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout>;

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		clearTimeout(toastTimeout);
		toast = { message, type };
		toastTimeout = setTimeout(() => { toast = null; }, 3000);
	}

	// Ticket modal state
	let showTicketModal = $state(false);
	let ticketSubmitting = $state(false);
	let ticketName = $state('');
	let ticketPrice = $state<number | string>('');
	let ticketColor = $state('#6366f1');

	// Reactive tickets list from event data
	let tickets = $state<Array<{ id?: string; ticket_name: string; ticket_price: number; ticket_color: string }>>(
		(() => data.event.tickets || [])()
	);

	function openTicketModal() {
		ticketName = '';
		ticketPrice = '';
		ticketColor = '#6366f1';
		showTicketModal = true;
	}

	function closeTicketModal() {
		showTicketModal = false;
	}

	async function handleAddTicket() {
		if (!ticketName.trim() || ticketPrice === '' || Number(ticketPrice) < 0) {
			alert('Please fill in the ticket name and a valid price.');
			return;
		}

		ticketSubmitting = true;

		try {
			const updatedTickets = [
				...tickets,
				{
					ticket_name: ticketName.trim(),
					ticket_price: Number(ticketPrice),
					ticket_color: ticketColor
				}
			];

			const res = await fetch(`${PAYLOAD_URL}/api/event/${event.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tickets: updatedTickets })
			});

			if (!res.ok) {
				const errorBody = await res.text().catch(() => '');
				throw new Error(`Failed to save ticket: ${res.status} ${errorBody}`);
			}

			const updated = await res.json();
			const doc = updated.doc || updated;
			tickets = doc.tickets || [];
			closeTicketModal();
			showToast('Ticket added successfully!');
		} catch (err: any) {
			showToast(err.message || 'Failed to add ticket.', 'error');
		} finally {
			ticketSubmitting = false;
		}
	}

	async function handleDeleteTicket(index: number) {
		try {
			const updatedTickets = tickets.filter((_, i) => i !== index);

			const res = await fetch(`${PAYLOAD_URL}/api/event/${event.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tickets: updatedTickets })
			});

			if (!res.ok) {
				throw new Error('Failed to delete ticket');
			}

			const updated = await res.json();
			const doc = updated.doc || updated;
			tickets = doc.tickets || [];
			showToast('Ticket removed successfully!');
		} catch (err: any) {
			showToast(err.message || 'Failed to delete ticket.', 'error');
		}
	}

	function handleTicketKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showTicketModal) {
			closeTicketModal();
		}
	}

	// Countdown state
	let days = $state(0);
	let hours = $state(0);
	let minutes = $state(0);
	let seconds = $state(0);
	let eventStarted = $state(false);

	function computeCountdown() {
		const startDate = event.event_date ? new Date(event.event_date) : null;
		if (!startDate) {
			eventStarted = true;
			return;
		}

		// If start_time is set, parse it into the date
		if (event.start_time) {
			const [h, m] = event.start_time.split(':').map(Number);
			startDate.setHours(h, m, 0, 0);
		}

		const now = new Date();
		const diff = startDate.getTime() - now.getTime();

		if (diff <= 0) {
			eventStarted = true;
			days = 0;
			hours = 0;
			minutes = 0;
			seconds = 0;
			return;
		}

		eventStarted = false;
		days = Math.floor(diff / (1000 * 60 * 60 * 24));
		hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
		minutes = Math.floor((diff / (1000 * 60)) % 60);
		seconds = Math.floor((diff / 1000) % 60);
	}

	computeCountdown();
	const countdownInterval = setInterval(computeCountdown, 1000);
	onDestroy(() => clearInterval(countdownInterval));

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatDateShort(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getMediaUrl(media: any): string | null {
		if (!media) return null;
		if (typeof media === 'string') return null;
		return media.url || null;
	}

	function formatTime(time: string): string {
		const [h, m] = time.split(':').map(Number);
		const period = h >= 12 ? 'PM' : 'AM';
		const hour12 = h % 12 || 12;
		return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
	}

	function pad(n: number): string {
		return n.toString().padStart(2, '0');
	}
</script>

<svelte:window onkeydown={handleTicketKeydown} />

<svelte:head>
	<title>{event.title} - Veent Tix</title>
</svelte:head>

<div class="dark min-h-screen bg-[#060a14] text-white">
	<!-- Aurora background -->
	<div class="aurora-bg">
		<div class="aurora-layer-1"></div>
		<div class="aurora-layer-2"></div>
	</div>

	<!-- Back link -->
	<div class="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-8">
		<a
			href="/event"
			class="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-red-300"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Events
		</a>
	</div>

	<!-- Main two-column layout -->
	<section class="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
		<div class="grid gap-8 lg:grid-cols-[1fr_1fr]">

			<!-- LEFT COLUMN: Poster + Countdown + Description -->
			<div class="space-y-6 fade-slide-up">
				<!-- Poster -->
				<div class="glass-card overflow-hidden rounded-2xl">
					{#if getMediaUrl(event.poster)}
						<img
							src={getMediaUrl(event.poster)}
							alt="{event.title} poster"
							class="w-full aspect-[4/5] object-cover"
						/>
					{:else}
						<div class="flex w-full aspect-[4/5] items-center justify-center bg-gradient-to-br from-red-600/20 via-red-600/15 to-red-600/20">
							<svg class="h-20 w-20 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
							</svg>
						</div>
					{/if}
				</div>

				<!-- Countdown -->
				<div class="glass-card rounded-2xl p-5">
					{#if eventStarted}
						<p class="text-sm font-semibold uppercase tracking-wider text-red-400 text-center">Event has started</p>
					{:else}
						<p class="text-sm font-semibold uppercase tracking-wider text-red-400 text-center mb-4">Event Starts In</p>
						<div class="grid grid-cols-4 gap-3">
							<div class="countdown-unit">
								<span class="countdown-value">{pad(days)}</span>
								<span class="countdown-label">Days</span>
							</div>
							<div class="countdown-unit">
								<span class="countdown-value">{pad(hours)}</span>
								<span class="countdown-label">Hours</span>
							</div>
							<div class="countdown-unit">
								<span class="countdown-value">{pad(minutes)}</span>
								<span class="countdown-label">Mins</span>
							</div>
							<div class="countdown-unit">
								<span class="countdown-value">{pad(seconds)}</span>
								<span class="countdown-label">Secs</span>
							</div>
						</div>
					{/if}
				</div>

				<!-- Description -->
				{#if event.content}
					<div class="glass-card rounded-2xl p-6">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-red-400 mb-3">Description</h2>
						<p class="text-gray-300 leading-relaxed whitespace-pre-line">{event.content}</p>
					</div>
				{/if}
			</div>

			<!-- RIGHT COLUMN: Event Name, Duration, Place -->
			<div class="space-y-6 fade-slide-up" style="animation-delay: 0.1s;">
				<!-- Event Name -->
				<div class="glass-card rounded-2xl p-6 sm:p-8">
					{#if getMediaUrl(event.company_logo)}
						<img
							src={getMediaUrl(event.company_logo)}
							alt="Company logo"
							class="h-14 w-14 rounded-xl object-contain bg-white/5 p-2 mb-4"
						/>
					{/if}
					<h1 class="gradient-text text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
						{event.title}
					</h1>
				</div>

				<!-- Event Duration -->
				<div class="glass-card rounded-2xl p-6">
					<h2 class="text-sm font-semibold uppercase tracking-wider text-red-400 mb-4">Event Duration</h2>

					<div class="space-y-4">
						<!-- Start -->
						{#if event.event_date}
							<div class="flex items-center gap-4">
								<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 shrink-0">
									<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
								<div>
									<p class="text-xs text-gray-500">Starts</p>
									<p class="text-sm font-medium text-gray-200">
										{formatDate(event.event_date)}{#if event.start_time}{' '}<span class="text-red-300">at {formatTime(event.start_time)}</span>{/if}
									</p>
								</div>
							</div>
						{/if}

						<!-- End -->
						{#if event.end_date || event.end_time}
							<div class="flex items-center gap-4">
								<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 shrink-0">
									<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
								<div>
									<p class="text-xs text-gray-500">Ends</p>
									<p class="text-sm font-medium text-gray-200">
										{#if event.end_date}{formatDate(event.end_date)}{/if}{#if event.end_time}{' '}<span class="text-red-300">at {formatTime(event.end_time)}</span>{/if}
									</p>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Location -->
				{#if event.location}
					<div class="glass-card rounded-2xl p-6">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-red-400 mb-4">Place</h2>
						<div class="flex items-center gap-4">
							<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 shrink-0">
								<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</div>
							<p class="text-base font-medium text-gray-200">{event.location}</p>
						</div>
					</div>
				{/if}

				<!-- Ticket Info -->
				<div class="glass-card rounded-2xl p-6">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-red-400">Ticket Info</h2>
						<button
							onclick={openTicketModal}
							class="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 transition-all hover:bg-red-500/25"
						>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
							Add Ticket
						</button>
					</div>

					{#if tickets.length > 0}
						<div class="space-y-3">
							{#each tickets as ticket, i}
								<div class="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
									<div
										class="h-8 w-8 rounded-lg shrink-0"
										style="background-color: {ticket.ticket_color};"
									></div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-200 truncate">{ticket.ticket_name}</p>
										<p class="text-xs text-gray-500">
											{ticket.ticket_price === 0 ? 'Free' : `₱${ticket.ticket_price.toFixed(2)}`}
										</p>
									</div>
									<button
										onclick={() => handleDeleteTicket(i)}
										class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-500/15 hover:text-red-400"
										aria-label="Remove ticket"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-gray-500 text-center py-4">No tickets added yet</p>
					{/if}
				</div>
			</div>

		</div>
	</section>
</div>

<!-- Toast Notification -->
{#if toast}
	<div class="fixed bottom-6 right-6 z-[60] toast-enter">
		<div class="flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl {toast.type === 'success' ? 'bg-red-600' : 'bg-red-600'}">
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

<!-- Add Ticket Modal -->
{#if showTicketModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
		onclick={(e) => { if (e.target === e.currentTarget) closeTicketModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeTicketModal(); }}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Add Ticket"
	>
		<div class="modal-enter modal-card relative w-full max-w-md rounded-2xl p-6 sm:p-8">
			<!-- Close Button -->
			<button
				onclick={closeTicketModal}
				class="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
				aria-label="Close"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<h2 class="text-xl font-bold text-white mb-6">Add Ticket Type</h2>

			<div class="space-y-4">
				<!-- Ticket Name -->
				<div>
					<label for="ticket-name" class="block text-sm font-medium text-gray-300 mb-1.5">Ticket Name <span class="text-red-400">*</span></label>
					<input
						id="ticket-name"
						type="text"
						bind:value={ticketName}
						placeholder="e.g. General Admission, VIP"
						class="modal-input"
					/>
				</div>

				<!-- Ticket Price -->
				<div>
					<label for="ticket-price" class="block text-sm font-medium text-gray-300 mb-1.5">Price <span class="text-red-400">*</span></label>
					<input
						id="ticket-price"
						type="number"
						min="0"
						step="0.01"
						bind:value={ticketPrice}
						placeholder="0.00"
						class="modal-input"
					/>
				</div>

				<!-- Ticket Color -->
				<div>
					<label for="ticket-color" class="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
					<div class="flex items-center gap-3">
						<input
							id="ticket-color"
							type="color"
							bind:value={ticketColor}
							class="h-10 w-14 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent p-1"
						/>
						<span class="text-sm text-gray-400 font-mono">{ticketColor}</span>
						<!-- Color presets -->
						<div class="flex gap-1.5 ml-auto">
							{#each ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'] as color}
								<button
									onclick={() => ticketColor = color}
									class="h-6 w-6 rounded-full border-2 transition-all {ticketColor === color ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}"
									style="background-color: {color};"
									aria-label="Select color {color}"
								></button>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="mt-8 flex items-center justify-end gap-3">
				<button
					onclick={closeTicketModal}
					disabled={ticketSubmitting}
					class="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-gray-300 transition-all hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={handleAddTicket}
					disabled={ticketSubmitting}
					class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition-all hover:shadow-xl hover:shadow-red-600/30 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if ticketSubmitting}
						<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
						Adding...
					{:else}
						Add Ticket
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
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

	/* Countdown styles */
	.countdown-unit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.countdown-value {
		font-size: 1.75rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		background: linear-gradient(135deg, #a5b4fc, #c4b5fd);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		line-height: 1;
	}

	.countdown-label {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgb(156, 163, 175);
	}

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

	/* Modal card - solid background */
	.modal-card {
		background: linear-gradient(135deg, #1a1f35 0%, #141829 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow:
			0 24px 64px rgba(0, 0, 0, 0.6),
			0 8px 24px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
</style>
