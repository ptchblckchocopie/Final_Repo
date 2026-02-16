<script lang="ts">
	import { goto } from '$app/navigation';
	import { getIsDark } from '$lib/stores/theme.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	interface CalendarEvent {
		id: number;
		title: string;
		description?: string | null;
		start_date: string;
		end_date: string;
		updatedAt: string;
		createdAt: string;
	}

	let { data } = $props();

	const isDark = $derived(getIsDark());

	let localEvents = $state<CalendarEvent[] | null>(null);
	const events = $derived(localEvents ?? data.events);
	const currentMonth = $derived(data.month);
	const currentYear = $derived(data.year);

	const MONTH_NAMES = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

	let monthDirection = $state<'left' | 'right' | null>(null);
	let gridKey = $state(0);

	const daysInCurrentMonth = $derived(new Date(currentYear, currentMonth + 1, 0).getDate());

	const calendarDays = $derived.by(() => {
		const firstDay = new Date(currentYear, currentMonth, 1).getDay();
		const days: (number | null)[] = [];
		for (let i = 0; i < firstDay; i++) days.push(null);
		for (let d = 1; d <= daysInCurrentMonth; d++) days.push(d);
		return days;
	});

	const totalEvents = $derived(events.length);
	const busyDaysCount = $derived.by(() => {
		let count = 0;
		for (let d = 1; d <= daysInCurrentMonth; d++) {
			if (eventsForDay(d).length > 0) count++;
		}
		return count;
	});
	const daysRemaining = $derived.by(() => {
		if (today.getMonth() === currentMonth && today.getFullYear() === currentYear) {
			return daysInCurrentMonth - today.getDate();
		}
		return daysInCurrentMonth;
	});
	const monthProgress = $derived.by(() => {
		if (today.getMonth() === currentMonth && today.getFullYear() === currentYear) {
			return (today.getDate() / daysInCurrentMonth) * 100;
		}
		return 0;
	});

	const miniMonthDays = $derived(Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1));

	function dateStr(day: number): string {
		return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function eventsForDay(day: number): CalendarEvent[] {
		const ds = dateStr(day);
		return events.filter((ev: CalendarEvent) => {
			const start = ev.start_date.slice(0, 10);
			const end = ev.end_date.slice(0, 10);
			return ds >= start && ds <= end;
		});
	}

	function isToday(day: number): boolean {
		return dateStr(day) === todayStr;
	}

	function prevMonth() {
		monthDirection = 'right';
		gridKey++;
		let m = currentMonth - 1;
		let y = currentYear;
		if (m < 0) { m = 11; y--; }
		selectedDay = null;
		localEvents = null;
		goto(`/event-calendar?month=${m}&year=${y}`);
	}

	function nextMonth() {
		monthDirection = 'left';
		gridKey++;
		let m = currentMonth + 1;
		let y = currentYear;
		if (m > 11) { m = 0; y++; }
		selectedDay = null;
		localEvents = null;
		goto(`/event-calendar?month=${m}&year=${y}`);
	}

	function goToToday() {
		monthDirection = 'left';
		gridKey++;
		selectedDay = null;
		localEvents = null;
		goto(`/event-calendar?month=${today.getMonth()}&year=${today.getFullYear()}`);
	}

	let selectedDay = $state<number | null>(null);
	const selectedEvents = $derived(selectedDay !== null ? eventsForDay(selectedDay) : []);

	function selectDay(day: number) {
		selectedDay = selectedDay === day ? null : day;
	}

	let showAddModal = $state(false);
	let addTitle = $state('');
	let addDescription = $state('');
	let addStartDate = $state('');
	let addEndDate = $state('');
	let submitting = $state(false);
	let addError = $state('');

	function openAddModal() {
		if (selectedDay !== null) {
			const ds = dateStr(selectedDay);
			addStartDate = ds;
			addEndDate = ds;
		}
		addTitle = '';
		addDescription = '';
		addError = '';
		showAddModal = true;
	}

	async function addEvent() {
		if (!addTitle.trim() || !addStartDate || !addEndDate) {
			addError = 'Title and dates are required.';
			return;
		}
		if (addEndDate < addStartDate) {
			addError = 'End date cannot be before start date.';
			return;
		}
		submitting = true;
		addError = '';
		try {
			const res = await fetch('/api/calendar-events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: addTitle.trim(),
					description: addDescription.trim() || null,
					start_date: addStartDate,
					end_date: addEndDate,
				}),
			});
			if (res.ok) {
				showAddModal = false;
				await refreshEvents();
			} else {
				addError = 'Failed to add event. Please try again.';
			}
		} catch {
			addError = 'Network error. Please try again.';
		} finally {
			submitting = false;
		}
	}

	let deletingId = $state<number | null>(null);

	async function deleteEvent(id: number) {
		deletingId = id;
		try {
			const res = await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' });
			if (res.ok) {
				await refreshEvents();
			}
		} catch {
			// ignore
		} finally {
			deletingId = null;
		}
	}

	async function refreshEvents() {
		try {
			const lastDay = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
			const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
			const endOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
			const params = new URLSearchParams({
				'where[start_date][less_than_equal]': endOfMonth,
				'where[end_date][greater_than_equal]': startOfMonth,
				limit: '100',
				sort: 'start_date',
			});
			const res = await fetch(`/api/calendar-events?${params}`);
			if (res.ok) {
				const json = await res.json();
				localEvents = json.docs;
			}
		} catch {
			// ignore
		}
	}

	let mouseX = $state(0);
	let mouseY = $state(0);

	function handleMouseMove(e: MouseEvent) {
		mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
		mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
	}
</script>

<svelte:head>
	<title>Event Calendar - Veent</title>
</svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="cal-page min-h-screen bg-gray-50 dark:bg-[#060a14]" class:dark={isDark} onmousemove={handleMouseMove}>

	<!-- ╔══════════════════════════════════════════════════════════════╗
	     ║  HERO SECTION — Aurora Background                          ║
	     ╚══════════════════════════════════════════════════════════════╝ -->
	<section class="hero-section relative overflow-hidden py-24 sm:py-32">
		<!-- Background base -->
		<div class="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-[#060a14] dark:via-[#0d1225] dark:to-[#060a14]"></div>

		<!-- Aurora layers -->
		<div class="aurora-bg">
			<div
				class="aurora-layer aurora-layer-1"
				style="transform: translate({mouseX * 20}px, {mouseY * 15}px);"
			></div>
			<div
				class="aurora-layer aurora-layer-2"
				style="transform: translate({mouseX * -15}px, {mouseY * -10}px);"
			></div>
			<div class="aurora-layer aurora-layer-3"></div>
		</div>

		<!-- Grid overlay -->
		<div class="grid-overlay absolute inset-0"></div>

		<!-- Floating light streaks -->
		<div class="light-streak streak-1"></div>
		<div class="light-streak streak-2"></div>
		<div class="light-streak streak-3"></div>

		<!-- Hero content -->
		<div class="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-3xl text-center">
				<div class="hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-300/60 bg-white/70 px-5 py-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]">
					<span class="relative flex h-2 w-2">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-60"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500"></span>
					</span>
					<span class="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">Event Calendar</span>
				</div>

				<h1 class="hero-title text-5xl font-black tracking-tight text-gray-950 dark:text-white sm:text-7xl lg:text-8xl">
					Your
					<span class="gradient-text-animated relative inline-block">Calendar</span>
				</h1>

				<p class="hero-subtitle mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-400 sm:mt-8 sm:text-lg">
					Mark busy days, track schedules, and stay organized — beautifully.
				</p>
			</div>
		</div>

		<!-- Stats bar (overlaps into next section) -->
		<div class="stats-entrance relative z-20 mx-auto mt-12 max-w-3xl px-4 sm:mt-16 sm:px-6 lg:px-8">
			<div class="grid grid-cols-3 gap-3 sm:gap-4">
				<div class="stat-card glass-card flex items-center gap-2.5 rounded-2xl p-3 sm:gap-3.5 sm:p-5">
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 sm:h-11 sm:w-11">
						<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
						</svg>
					</div>
					<div class="min-w-0">
						<p class="text-lg font-bold text-gray-900 dark:text-white sm:text-2xl">{totalEvents}</p>
						<p class="truncate text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">Events</p>
					</div>
				</div>

				<div class="stat-card glass-card flex items-center gap-2.5 rounded-2xl p-3 sm:gap-3.5 sm:p-5" style="animation-delay: 80ms">
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 sm:h-11 sm:w-11">
						<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="min-w-0">
						<p class="text-lg font-bold text-gray-900 dark:text-white sm:text-2xl">{busyDaysCount}</p>
						<p class="truncate text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">Busy Days</p>
					</div>
				</div>

				<div class="stat-card glass-card flex items-center gap-2.5 rounded-2xl p-3 sm:gap-3.5 sm:p-5" style="animation-delay: 160ms">
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 sm:h-11 sm:w-11">
						<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
						</svg>
					</div>
					<div class="min-w-0">
						<p class="text-lg font-bold text-gray-900 dark:text-white sm:text-2xl">{daysRemaining}</p>
						<p class="truncate text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">Days Left</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ╔══════════════════════════════════════════════════════════════╗
	     ║  CALENDAR SECTION                                          ║
	     ╚══════════════════════════════════════════════════════════════╝ -->
	<section class="relative pb-24 pt-12">
		<!-- Ambient glow -->
		<div class="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-indigo-200/20 blur-[100px] dark:bg-indigo-600/[0.06]"></div>

		<div class="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

			<!-- Month Navigation -->
			<div class="nav-glass glass-card mb-4 rounded-2xl px-4 py-3 sm:mb-6 sm:px-6 sm:py-4">
				<div class="flex items-center justify-between">
					<button
						onclick={prevMonth}
						class="nav-arrow group flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-300/80 bg-white/70 px-3 py-2 text-sm font-semibold text-gray-700 backdrop-blur-sm transition-all duration-300 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-lg hover:shadow-indigo-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 sm:px-4 sm:py-2.5"
					>
						<svg class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
						<span class="hidden sm:inline">Prev</span>
					</button>

					<div class="flex flex-col items-center gap-2">
						<div class="flex items-center gap-2 sm:gap-3">
							<h2 class="month-title text-lg font-bold sm:text-2xl lg:text-3xl">
								<span class="text-gray-950 dark:text-white">{MONTH_NAMES[currentMonth]}</span>
								<span class="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">{currentYear}</span>
							</h2>
							<button
								onclick={goToToday}
								class="cursor-pointer rounded-lg border border-indigo-300 bg-gradient-to-r from-indigo-100 to-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 transition-all duration-300 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/10 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-violet-500/10 dark:text-indigo-400 dark:hover:border-indigo-500/50 sm:text-xs"
							>
								Today
							</button>
						</div>

						<!-- Mini month dots -->
						<div class="hidden items-center gap-1 rounded-lg border border-gray-200/40 bg-gray-100/60 px-2.5 py-1.5 dark:border-white/[0.06] dark:bg-white/[0.04] sm:flex">
							{#each miniMonthDays as d}
								{@const hasEv = eventsForDay(d).length > 0}
								{@const isT = isToday(d)}
								{@const isSel = selectedDay === d}
								<button
									onclick={() => selectDay(d)}
									class="h-1.5 w-1.5 cursor-pointer rounded-full transition-all duration-200 hover:scale-150
										{isT ? 'scale-150 !bg-indigo-500 shadow-sm shadow-indigo-500/60' :
										 hasEv ? '!bg-rose-500 shadow-sm shadow-rose-400/40' :
										 isSel ? '!bg-indigo-400' :
										 '!bg-gray-400 dark:!bg-gray-600 hover:!bg-gray-500 dark:hover:!bg-gray-500'}"
									aria-label="Day {d}"
								></button>
							{/each}
						</div>
					</div>

					<div class="flex items-center gap-2">
						<ThemeToggle />
						<button
							onclick={nextMonth}
							class="nav-arrow group flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-300/80 bg-white/70 px-3 py-2 text-sm font-semibold text-gray-700 backdrop-blur-sm transition-all duration-300 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-lg hover:shadow-indigo-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 sm:px-4 sm:py-2.5"
						>
							<span class="hidden sm:inline">Next</span>
							<svg class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			<!-- Month progress bar -->
			{#if monthProgress > 0}
				<div class="mb-4 h-1 overflow-hidden rounded-full bg-gray-200/60 dark:bg-white/[0.06] sm:mb-6">
					<div
						class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 transition-all duration-700 ease-out"
						style="width: {monthProgress}%"
					></div>
				</div>
			{/if}

			<!-- Calendar + Detail layout -->
			<div class="flex flex-col xl:flex-row xl:items-start xl:gap-6">

				<!-- Calendar Grid -->
				<div class="min-w-0 flex-1">
					<div class="calendar-glass overflow-hidden rounded-3xl">
						<!-- Day Headers -->
						<div class="grid grid-cols-7 border-b border-gray-200/40 bg-gradient-to-r from-gray-50/80 via-white/60 to-gray-50/80 dark:border-white/[0.04] dark:from-white/[0.03] dark:via-white/[0.01] dark:to-white/[0.03]">
							{#each DAY_NAMES as dayName, i}
								<div
									class="day-header py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 dark:text-gray-500 sm:py-4 sm:text-xs"
									style="animation-delay: {i * 40}ms"
								>
									{dayName}
								</div>
							{/each}
						</div>

						<!-- Grid Cells -->
						{#key gridKey}
							<div class="calendar-grid grid grid-cols-7" class:slide-in-left={monthDirection === 'left'} class:slide-in-right={monthDirection === 'right'}>
								{#each calendarDays as day, i}
									{#if day === null}
										<div class="empty-cell border-b border-r border-gray-100/80 bg-gray-50/30 dark:border-white/[0.03] dark:bg-white/[0.008]" style="min-height: 88px;"></div>
									{:else}
										{@const dayEvents = eventsForDay(day)}
										{@const isBusy = dayEvents.length > 0}
										{@const isSelected = selectedDay === day}
										{@const todayCheck = isToday(day)}
										<button
											onclick={() => selectDay(day)}
											class="day-cell group relative cursor-pointer border-b border-r border-gray-100/80 p-1.5 text-left transition-all duration-300 dark:border-white/[0.03] sm:p-2
												{isBusy ? 'busy-cell' : ''}
												{isSelected ? 'selected-cell' : ''}
												{todayCheck ? 'today-cell' : ''}"
											style="min-height: 88px; animation-delay: {(i % 7) * 25 + Math.floor(i / 7) * 35}ms;"
										>
											<!-- Hover gradient -->
											<div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-violet-500/0 to-purple-500/0 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:from-indigo-50/70 group-hover:via-violet-50/40 group-hover:to-purple-50/20 dark:group-hover:from-indigo-500/[0.06] dark:group-hover:via-violet-500/[0.04] dark:group-hover:to-purple-500/[0.02]"></div>

											<!-- Hover top accent -->
											<div class="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 opacity-0 transition-opacity duration-300 group-hover:opacity-60"></div>

											<!-- Selected ring -->
											{#if isSelected}
												<div class="pointer-events-none absolute inset-0 ring-2 ring-inset ring-indigo-500/50 dark:ring-indigo-400/40"></div>
												<div class="pointer-events-none absolute inset-0 bg-indigo-50/50 dark:bg-indigo-500/[0.08]"></div>
											{/if}

											<!-- Cell content -->
											<div class="relative z-10">
												<div class="flex items-start justify-between">
													<span
														class="day-number inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 sm:text-sm
															{todayCheck
																? 'today-badge bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40'
																: isSelected
																	? 'text-indigo-600 dark:text-indigo-300 font-bold'
																	: 'text-gray-700 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-200'}"
													>
														{day}
													</span>
													{#if isBusy}
														<span class="relative mt-1 flex h-2 w-2">
															<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-40"></span>
															<span class="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 shadow-sm shadow-rose-500/40"></span>
														</span>
													{/if}
												</div>
												{#if dayEvents.length > 0}
													<div class="mt-1 space-y-0.5 sm:mt-1.5 sm:space-y-1">
														{#each dayEvents.slice(0, 2) as ev}
															<div class="event-pill truncate rounded-md border border-rose-200/50 bg-gradient-to-r from-rose-50/80 to-pink-50/60 px-1.5 py-0.5 text-[9px] font-medium leading-tight text-rose-600 dark:border-rose-500/20 dark:from-rose-500/15 dark:to-pink-500/10 dark:text-rose-300 sm:text-[11px]">
																{ev.title}
															</div>
														{/each}
														{#if dayEvents.length > 2}
															<div class="text-[9px] font-medium text-gray-400 dark:text-gray-600 sm:text-[10px]">+{dayEvents.length - 2} more</div>
														{/if}
													</div>
												{/if}
											</div>

											<!-- Busy day bottom accent -->
											{#if isBusy}
												<div class="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-rose-400/60 via-pink-400/40 to-rose-400/60"></div>
											{/if}
										</button>
									{/if}
								{/each}
							</div>
						{/key}
					</div>
				</div>

				<!-- Detail Panel -->
				<div class="mt-6 xl:mt-0 xl:w-[360px] xl:shrink-0">
					<div class="detail-panel glass-card overflow-hidden rounded-3xl" class:detail-enter={selectedDay !== null}>
						{#if selectedDay !== null}
							<!-- Gradient accent bar -->
							<div class="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>

							<div class="p-5 sm:p-6">
								<!-- Header -->
								<div class="mb-5 flex items-center justify-between gap-3">
									<div class="min-w-0">
										<p class="mb-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-500 dark:text-indigo-400">Selected</p>
										<h3 class="truncate text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
											{MONTH_NAMES[currentMonth]} {selectedDay}
										</h3>
									</div>
									<button
										onclick={openAddModal}
										class="add-btn group inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-200/60 bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/35 hover:brightness-110 dark:border-indigo-500/30 sm:px-4 sm:py-2.5 sm:text-sm"
									>
										<svg class="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
										</svg>
										Add
									</button>
								</div>

								<!-- Events timeline -->
								{#if selectedEvents.length > 0}
									<div class="timeline relative space-y-3">
										<!-- Timeline line -->
										<div class="absolute bottom-3 left-[7px] top-3 w-[2px] rounded-full bg-gradient-to-b from-indigo-200 via-violet-200 to-purple-200 dark:from-indigo-500/30 dark:via-violet-500/20 dark:to-purple-500/10"></div>

										{#each selectedEvents as ev, i}
											<div class="timeline-item relative flex gap-3.5 pl-5" style="animation-delay: {i * 60}ms">
												<!-- Dot -->
												<div class="absolute left-0 top-2.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30 dark:border-[#0d1222]">
													<div class="h-1 w-1 rounded-full bg-white"></div>
												</div>

												<!-- Event card -->
												<div class="event-card group/card min-w-0 flex-1 rounded-xl border border-gray-200/60 bg-white/60 p-3.5 backdrop-blur-sm transition-all duration-300 hover:border-gray-300/60 hover:bg-white/80 hover:shadow-lg hover:shadow-gray-900/5 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.06] dark:hover:shadow-black/20 sm:p-4">
													<div class="flex items-start justify-between gap-2">
														<div class="min-w-0 flex-1">
															<h4 class="truncate text-sm font-semibold text-gray-900 dark:text-white">{ev.title}</h4>
															{#if ev.description}
																<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{ev.description}</p>
															{/if}
															<p class="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-200/60 bg-gray-50/80 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-gray-500">
																<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
																</svg>
																{#if ev.start_date.slice(0, 10) === ev.end_date.slice(0, 10)}
																	{ev.start_date.slice(0, 10)}
																{:else}
																	{ev.start_date.slice(0, 10)} &rarr; {ev.end_date.slice(0, 10)}
																{/if}
															</p>
														</div>
														<button
															onclick={() => deleteEvent(ev.id)}
															disabled={deletingId === ev.id}
															class="shrink-0 cursor-pointer rounded-lg border border-gray-200/60 bg-white/80 p-1.5 text-gray-400 transition-all duration-300 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500 hover:shadow-md hover:shadow-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-gray-500 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 sm:p-2"
															aria-label="Delete event"
														>
															{#if deletingId === ev.id}
																<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
																	<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
																	<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
																</svg>
															{:else}
																<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																</svg>
															{/if}
														</button>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<!-- Empty state -->
									<div class="flex flex-col items-center rounded-2xl border border-dashed border-gray-200/80 bg-gradient-to-b from-gray-50/50 to-white py-10 text-center dark:border-white/[0.06] dark:from-white/[0.02] dark:to-transparent">
										<div class="mb-4 text-gray-300 dark:text-gray-700">
											<svg viewBox="0 0 80 80" class="h-16 w-16">
												<rect x="12" y="20" width="56" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4" />
												<rect x="12" y="20" width="56" height="14" rx="6" fill="currentColor" opacity="0.06" />
												<line x1="28" y1="12" x2="28" y2="26" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.3" />
												<line x1="52" y1="12" x2="52" y2="26" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.3" />
												<circle cx="40" cy="50" r="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2" />
												<path d="M37 50h6M40 47v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3" />
											</svg>
										</div>
										<p class="text-sm font-medium text-gray-500 dark:text-gray-500">No events</p>
										<p class="mt-1 text-xs text-gray-400 dark:text-gray-600">Click "Add" to mark this day as busy</p>
									</div>
								{/if}
							</div>
						{:else}
							<!-- No day selected placeholder -->
							<div class="flex flex-col items-center px-6 py-16 text-center">
								<div class="mb-5 text-gray-300 dark:text-gray-700">
									<svg viewBox="0 0 100 100" class="h-20 w-20 sm:h-24 sm:w-24">
										<rect x="15" y="25" width="70" height="60" rx="8" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3" />
										<rect x="15" y="25" width="70" height="16" rx="8" fill="currentColor" opacity="0.05" />
										<line x1="32" y1="16" x2="32" y2="32" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.2" />
										<line x1="68" y1="16" x2="68" y2="32" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.2" />
										<circle cx="35" cy="55" r="3" fill="currentColor" opacity="0.08" />
										<circle cx="50" cy="55" r="3" fill="currentColor" opacity="0.08" />
										<circle cx="65" cy="55" r="3" fill="currentColor" opacity="0.12" />
										<circle cx="35" cy="70" r="3" fill="currentColor" opacity="0.08" />
										<circle cx="50" cy="70" r="3" fill="currentColor" opacity="0.08" />
										<circle cx="65" cy="55" r="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.15" class="placeholder-ring" />
									</svg>
								</div>
								<p class="text-sm font-semibold text-gray-500 dark:text-gray-500">Select a day</p>
								<p class="mt-1 max-w-[200px] text-xs leading-relaxed text-gray-400 dark:text-gray-600">Click any day on the calendar to view or add events</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

<!-- ╔══════════════════════════════════════════════════════════════╗
     ║  ADD EVENT MODAL                                           ║
     ╚══════════════════════════════════════════════════════════════╝ -->
{#if showAddModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop fixed inset-0 z-[9998] flex items-center justify-center"
		class:dark={isDark}
		onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') showAddModal = false; }}
	>
		<div class="modal-content mx-4 w-full max-w-md">
			<div class="modal-card relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white/95 shadow-2xl shadow-gray-900/10 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#0d1222]/95 dark:shadow-black/60">
				<!-- Gradient top -->
				<div class="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>

				<!-- Decorative glow -->
				<div class="pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-indigo-200/30 blur-[60px] dark:bg-indigo-500/15"></div>

				<div class="relative p-6 sm:p-8">
					<div class="mb-6 flex items-center justify-between">
						<div>
							<h3 class="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">Add Busy Day</h3>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-500">Mark a day or range as busy</p>
						</div>
						<button
							onclick={() => (showAddModal = false)}
							class="cursor-pointer rounded-xl border border-gray-200/60 bg-gray-100/80 p-2 text-gray-500 transition-all duration-300 hover:border-gray-300 hover:bg-gray-200/80 hover:text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-gray-400 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.1] dark:hover:text-white"
							aria-label="Close"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form onsubmit={(e) => { e.preventDefault(); addEvent(); }} class="space-y-4">
						{#if addError}
							<div class="error-shake rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-2.5 text-xs font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 sm:text-sm">
								{addError}
							</div>
						{/if}

						<div class="form-field">
							<label for="cal-title" class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title</label>
							<input
								id="cal-title"
								type="text"
								bind:value={addTitle}
								required
								class="modal-input w-full rounded-xl border border-gray-200/80 bg-gray-50/80 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder-gray-600 dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								placeholder="e.g. Team meeting"
							/>
						</div>

						<div class="form-field" style="animation-delay: 40ms">
							<label for="cal-desc" class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
								Description <span class="font-normal text-gray-400 dark:text-gray-600">(optional)</span>
							</label>
							<textarea
								id="cal-desc"
								bind:value={addDescription}
								rows="2"
								class="modal-input w-full resize-none rounded-xl border border-gray-200/80 bg-gray-50/80 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder-gray-600 dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								placeholder="Add details..."
							></textarea>
						</div>

						<div class="form-field grid grid-cols-2 gap-3" style="animation-delay: 80ms">
							<div>
								<label for="cal-start" class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">Start</label>
								<input
									id="cal-start"
									type="date"
									bind:value={addStartDate}
									required
									class="modal-input w-full rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-2.5 text-sm text-gray-900 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								/>
							</div>
							<div>
								<label for="cal-end" class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">End</label>
								<input
									id="cal-end"
									type="date"
									bind:value={addEndDate}
									required
									class="modal-input w-full rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-2.5 text-sm text-gray-900 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								/>
							</div>
						</div>

						<div class="flex justify-end gap-2.5 pt-2">
							<button
								type="button"
								onclick={() => (showAddModal = false)}
								class="cursor-pointer rounded-xl border border-gray-200/60 bg-white/80 px-4 py-2.5 text-xs font-semibold text-gray-600 transition-all duration-300 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.08] dark:hover:text-white sm:text-sm"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={submitting}
								class="submit-btn group inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
							>
								{#if submitting}
									<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Adding...
								{:else}
									Add Event
									<svg class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
									</svg>
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ══════════════════════════════════════════════════════════════
	   AURORA BOREALIS BACKGROUND
	   ══════════════════════════════════════════════════════════════ */
	.aurora-bg {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.aurora-layer {
		position: absolute;
		will-change: transform;
		transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}

	.aurora-layer-1 {
		inset: -60%;
		background: conic-gradient(
			from 220deg at 50% 48%,
			transparent 0deg,
			rgba(99, 102, 241, 0.03) 60deg,
			transparent 120deg,
			rgba(139, 92, 246, 0.02) 200deg,
			transparent 280deg,
			rgba(99, 102, 241, 0.02) 340deg,
			transparent 360deg
		);
		animation: auroraRotate 35s linear infinite;
	}

	.aurora-layer-2 {
		inset: -30%;
		background:
			radial-gradient(ellipse 70% 50% at 30% 50%, rgba(99, 102, 241, 0.04), transparent 65%),
			radial-gradient(ellipse 60% 40% at 70% 60%, rgba(139, 92, 246, 0.03), transparent 55%),
			radial-gradient(ellipse 50% 50% at 50% 30%, rgba(168, 85, 247, 0.02), transparent 60%);
		animation: auroraPulse 10s ease-in-out infinite alternate;
	}

	.aurora-layer-3 {
		inset: 0;
		background: linear-gradient(180deg, transparent 0%, rgba(99, 102, 241, 0.015) 50%, transparent 100%);
		animation: auroraShimmer 8s ease-in-out infinite alternate;
	}

	:global(.dark) .aurora-layer-1 {
		background: conic-gradient(
			from 220deg at 50% 48%,
			transparent 0deg,
			rgba(99, 102, 241, 0.18) 60deg,
			transparent 120deg,
			rgba(139, 92, 246, 0.12) 200deg,
			transparent 280deg,
			rgba(99, 102, 241, 0.1) 340deg,
			transparent 360deg
		);
	}

	:global(.dark) .aurora-layer-2 {
		background:
			radial-gradient(ellipse 70% 50% at 30% 50%, rgba(99, 102, 241, 0.2), transparent 65%),
			radial-gradient(ellipse 60% 40% at 70% 60%, rgba(139, 92, 246, 0.15), transparent 55%),
			radial-gradient(ellipse 50% 50% at 50% 30%, rgba(168, 85, 247, 0.1), transparent 60%);
	}

	:global(.dark) .aurora-layer-3 {
		background: linear-gradient(180deg, transparent 0%, rgba(99, 102, 241, 0.06) 50%, transparent 100%);
	}

	@keyframes auroraRotate {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	@keyframes auroraPulse {
		0% { opacity: 0.7; transform: scale(1); }
		100% { opacity: 1; transform: scale(1.08); }
	}
	@keyframes auroraShimmer {
		0% { opacity: 0.4; }
		100% { opacity: 1; }
	}

	/* ══════════════════════════════════════════════════════════════
	   LIGHT STREAKS
	   ══════════════════════════════════════════════════════════════ */
	.light-streak {
		position: absolute;
		height: 1px;
		border-radius: 999px;
		pointer-events: none;
		opacity: 0.06;
	}

	:global(.dark) .light-streak { opacity: 0.2; }

	.streak-1 {
		width: 300px;
		top: 25%;
		left: -5%;
		background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent);
		animation: streakDrift1 20s ease-in-out infinite;
	}
	.streak-2 {
		width: 200px;
		top: 55%;
		right: -5%;
		background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent);
		animation: streakDrift2 25s ease-in-out infinite;
	}
	.streak-3 {
		width: 250px;
		top: 75%;
		left: 30%;
		background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.25), transparent);
		animation: streakDrift3 18s ease-in-out infinite;
	}

	@keyframes streakDrift1 {
		0%, 100% { transform: translateX(0) rotate(-5deg); opacity: 0; }
		20% { opacity: 0.2; }
		50% { transform: translateX(calc(100vw + 300px)) rotate(-5deg); opacity: 0.15; }
		80% { opacity: 0; }
	}
	@keyframes streakDrift2 {
		0%, 100% { transform: translateX(0) rotate(3deg); opacity: 0; }
		30% { opacity: 0.15; }
		60% { transform: translateX(calc(-100vw - 200px)) rotate(3deg); opacity: 0.1; }
		90% { opacity: 0; }
	}
	@keyframes streakDrift3 {
		0%, 100% { transform: translateX(0) rotate(-2deg); opacity: 0; }
		25% { opacity: 0.12; }
		75% { transform: translateX(400px) rotate(-2deg); opacity: 0.08; }
	}

	/* ══════════════════════════════════════════════════════════════
	   GRID OVERLAY
	   ══════════════════════════════════════════════════════════════ */
	.grid-overlay {
		opacity: 0.015;
		background-image:
			linear-gradient(rgba(99, 102, 241, 0.2) 1px, transparent 1px),
			linear-gradient(90deg, rgba(99, 102, 241, 0.2) 1px, transparent 1px);
		background-size: 50px 50px;
	}

	:global(.dark) .grid-overlay {
		opacity: 0.02;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
	}

	/* ══════════════════════════════════════════════════════════════
	   GLASS MORPHISM
	   ══════════════════════════════════════════════════════════════ */
	.glass-card {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.55) 100%);
		border: 1px solid rgba(0, 0, 0, 0.08);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.06),
			0 2px 8px rgba(0, 0, 0, 0.04),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global(.dark) .glass-card {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.012) 100%);
		border: 1px solid rgba(255, 255, 255, 0.06);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.35),
			0 2px 8px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.calendar-glass {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.65) 100%);
		border: 1px solid rgba(0, 0, 0, 0.05);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.03),
			inset 0 1px 0 rgba(255, 255, 255, 1),
			inset 0 -1px 0 rgba(0, 0, 0, 0.02);
	}

	:global(.dark) .calendar-glass {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%);
		border: 1px solid rgba(255, 255, 255, 0.06);
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.5),
			0 4px 16px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.04),
			inset 0 -1px 0 rgba(0, 0, 0, 0.15);
	}

	/* ══════════════════════════════════════════════════════════════
	   GRADIENT ANIMATED TEXT
	   ══════════════════════════════════════════════════════════════ */
	.gradient-text-animated {
		background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7, #d946ef, #8b5cf6, #6366f1);
		background-size: 200% auto;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		animation: gradientShift 6s ease-in-out infinite;
	}

	@keyframes gradientShift {
		0%, 100% { background-position: 0% center; }
		50% { background-position: 100% center; }
	}

	/* ══════════════════════════════════════════════════════════════
	   HERO ENTRANCE ANIMATIONS
	   ══════════════════════════════════════════════════════════════ */
	.hero-badge {
		animation: fadeSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.1s;
	}
	.hero-title {
		animation: fadeSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.2s;
	}
	.hero-subtitle {
		animation: fadeSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.35s;
	}
	.stats-entrance {
		animation: fadeSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.5s;
	}
	.stat-card {
		animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.55s;
	}

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(24px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* ═════════════════════════════==═════════════════════════════════
	   DAY HEADER
	   ══════════════════════════════════════════════════════════════ */
	.day-header {
		animation: fadeSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes fadeSlideDown {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ══════════════════════════════════════════════════════════════
	   CALENDAR GRID TRANSITIONS
	   ══════════════════════════════════════════════════════════════ */
	.calendar-grid {
		animation: gridFadeIn 0.35s ease-out both;
	}
	.slide-in-left {
		animation: slideFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.slide-in-right {
		animation: slideFromLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes gridFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes slideFromRight {
		from { opacity: 0; transform: translateX(30px); }
		to { opacity: 1; transform: translateX(0); }
	}
	@keyframes slideFromLeft {
		from { opacity: 0; transform: translateX(-30px); }
		to { opacity: 1; transform: translateX(0); }
	}

	/* ══════════════════════════════════════════════════════════════
	   DAY CELLS
	   ══════════════════════════════════════════════════════════════ */
	.day-cell {
		animation: cellFadeIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.day-cell:hover {
		z-index: 2;
	}
	.day-cell:active {
		animation: cellPing 0.25s ease-out;
	}

	@keyframes cellFadeIn {
		from { opacity: 0; transform: scale(0.96); }
		to { opacity: 1; transform: scale(1); }
	}
	@keyframes cellPing {
		0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3); }
		100% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
	}

	/* Busy cell */
	.busy-cell {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.04) 0%, rgba(236, 72, 153, 0.02) 100%);
	}
	.busy-cell:hover {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(236, 72, 153, 0.04) 100%);
	}
	:global(.dark) .busy-cell {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.04) 0%, rgba(236, 72, 153, 0.015) 100%);
	}
	:global(.dark) .busy-cell:hover {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(236, 72, 153, 0.04) 100%);
	}

	/* Today cell */
	.today-cell {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.03) 100%);
	}
	:global(.dark) .today-cell {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.025) 100%);
	}

	.today-badge {
		animation: todayPulse 3s ease-in-out infinite;
	}

	@keyframes todayPulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3), 0 4px 12px rgba(99, 102, 241, 0.3); }
		50% { box-shadow: 0 0 0 5px rgba(99, 102, 241, 0), 0 4px 12px rgba(99, 102, 241, 0.15); }
	}

	/* Event pill hover */
	.event-pill {
		transition: all 0.25s ease;
	}
	.day-cell:hover .event-pill {
		border-color: rgba(244, 63, 94, 0.3);
		background: linear-gradient(to right, rgba(244, 63, 94, 0.1), rgba(236, 72, 153, 0.06));
	}
	:global(.dark) .day-cell:hover .event-pill {
		border-color: rgba(244, 63, 94, 0.3);
		background: linear-gradient(to right, rgba(244, 63, 94, 0.18), rgba(236, 72, 153, 0.12));
	}

	/* ══════════════════════════════════════════════════════════════
	   DETAIL PANEL
	   ══════════════════════════════════════════════════════════════ */
	.detail-panel {
		transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.detail-enter {
		animation: panelSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes panelSlideIn {
		from { opacity: 0; transform: translateY(20px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* Timeline items */
	.timeline-item {
		animation: fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* Event card hover */
	.event-card {
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}

	/* Placeholder ring animation */
	.placeholder-ring {
		animation: placeholderPulse 3s ease-in-out infinite;
	}
	@keyframes placeholderPulse {
		0%, 100% { r: 6; opacity: 0.15; }
		50% { r: 9; opacity: 0.08; }
	}

	/* ══════════════════════════════════════════════════════════════
	   MODAL
	   ══════════════════════════════════════════════════════════════ */
	.modal-backdrop {
		background: rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		animation: backdropIn 0.25s ease-out both;
	}
	:global(.dark) .modal-backdrop {
		background: rgba(0, 0, 0, 0.55);
	}

	.modal-content {
		animation: modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.08s;
	}

	@keyframes backdropIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes modalIn {
		from { opacity: 0; transform: translateY(30px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.form-field {
		animation: fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.error-shake {
		animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}
	@keyframes shake {
		10%, 90% { transform: translateX(-1px); }
		20%, 80% { transform: translateX(2px); }
		30%, 50%, 70% { transform: translateX(-3px); }
		40%, 60% { transform: translateX(3px); }
	}

	/* Input focus glow */
	.modal-input:focus {
		box-shadow:
			0 0 0 2px rgba(99, 102, 241, 0.08),
			0 6px 20px rgba(99, 102, 241, 0.06);
	}
	:global(.dark) .modal-input:focus {
		box-shadow:
			0 0 0 2px rgba(99, 102, 241, 0.12),
			0 6px 20px rgba(99, 102, 241, 0.08);
	}

	/* Submit button glow */
	.submit-btn:not(:disabled):hover {
		box-shadow:
			0 8px 28px rgba(99, 102, 241, 0.35),
			0 0 0 1px rgba(99, 102, 241, 0.15);
	}

	/* Add button glow */
	.add-btn:hover {
		box-shadow:
			0 8px 28px rgba(99, 102, 241, 0.3),
			0 0 0 1px rgba(99, 102, 241, 0.1);
	}

	/* Date inputs dark mode */
	:global(.dark) input[type="date"]::-webkit-calendar-picker-indicator {
		filter: invert(0.6);
		cursor: pointer;
	}

	/* Month title */
	.month-title {
		animation: fadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* ══════════════════════════════════════════════════════════════
	   REDUCED MOTION
	   ══════════════════════════════════════════════════════════════ */
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
