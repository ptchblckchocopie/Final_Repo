<script lang="ts">
	import { onMount } from 'svelte';
	import SnakeGame from '$lib/components/game/SnakeGame.svelte';
	import { getIsDark } from '$lib/stores/theme.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import {
		DEFAULT_COSMETICS,
		PATTERN_OPTIONS,
		HAT_OPTIONS,
		EYES_OPTIONS,
		type SnakeCosmetics,
		type SnakePattern,
		type SnakeHat,
		type SnakeEyes,
	} from '$lib/types/snake';

	const PRESET_COLORS = [
		{ hex: '#22c55e', name: 'Green' },
		{ hex: '#3b82f6', name: 'Blue' },
		{ hex: '#ef4444', name: 'Red' },
		{ hex: '#f59e0b', name: 'Amber' },
		{ hex: '#a855f7', name: 'Purple' },
		{ hex: '#ec4899', name: 'Pink' },
		{ hex: '#14b8a6', name: 'Teal' },
		{ hex: '#f97316', name: 'Orange' },
		{ hex: '#6366f1', name: 'Indigo' },
		{ hex: '#06b6d4', name: 'Cyan' },
	];

	let playerName = $state('');
	let nameInput = $state('');
	let selectedColor = $state(PRESET_COLORS[0].hex);
	let selectedPattern = $state<SnakePattern>('solid');
	let selectedHat = $state<SnakeHat>('none');
	let selectedEyes = $state<SnakeEyes>('normal');
	let inGame = $state(false);
	let cosmeticsOpen = $state(false);
	const isDark = $derived(getIsDark());

	const cosmetics = $derived<SnakeCosmetics>({
		pattern: selectedPattern,
		hat: selectedHat,
		eyes: selectedEyes,
	});

	onMount(() => {
		const savedName = localStorage.getItem('snake-game-name');
		const savedColor = localStorage.getItem('snake-game-color');
		const savedCosmetics = localStorage.getItem('snake-game-cosmetics');
		if (savedName) nameInput = savedName;
		if (savedColor && PRESET_COLORS.some((c) => c.hex === savedColor)) selectedColor = savedColor;
		if (savedCosmetics) {
			try {
				const parsed = JSON.parse(savedCosmetics);
				if (parsed.pattern) selectedPattern = parsed.pattern;
				if (parsed.hat) selectedHat = parsed.hat;
				if (parsed.eyes) selectedEyes = parsed.eyes;
			} catch {}
		}
	});

	function joinGame(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = nameInput.trim();
		if (!trimmed) return;
		playerName = trimmed;
		localStorage.setItem('snake-game-name', trimmed);
		localStorage.setItem('snake-game-color', selectedColor);
		localStorage.setItem('snake-game-cosmetics', JSON.stringify(cosmetics));
		inGame = true;
	}

	function leaveGame() {
		inGame = false;
		playerName = '';
	}
</script>

<svelte:head>
	<title>Snake Game - Veent Tix</title>
</svelte:head>

<div class:dark={isDark}>
{#if !inGame}
	<!-- HERO SECTION -->
	<section class="relative overflow-hidden bg-slate-900 py-24 text-white">
		<div
			class="absolute inset-0 bg-gradient-to-br from-red-600/15 via-transparent to-red-600/10"
		></div>
		<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-3xl text-center">
				<p class="mb-4 text-sm font-semibold uppercase tracking-wider text-red-400">
					Multiplayer
				</p>
				<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">Snake Game</h1>
				<p class="mt-6 text-lg leading-relaxed text-gray-400">
					Compete with friends in real-time. Eat food, grow longer, and don't crash!
				</p>
			</div>
		</div>
	</section>

	<!-- FORM SECTION -->
	<section class="bg-white dark:bg-gray-900 py-20">
		<div class="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
			<div class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm">
				<!-- Theme toggle -->
				<div class="flex justify-end -mt-2 -mr-2 mb-2">
					<ThemeToggle />
				</div>

				<div
					class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-red-500/25"
					style="background: linear-gradient(135deg, {selectedColor}, {selectedColor}bb)"
				>
					<svg
						class="h-8 w-8 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
						/>
					</svg>
				</div>

				<h2 class="text-center text-xl font-bold text-gray-900 dark:text-gray-100">Join the game</h2>
				<p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
					Pick a name, color, and customize your snake
				</p>

				<form onsubmit={joinGame} class="mt-6 space-y-5">
					<!-- Name input -->
					<div>
						<label for="snake-name" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Player Name
						</label>
						<input
							id="snake-name"
							type="text"
							bind:value={nameInput}
							required
							maxlength={20}
							class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 transition-all focus:border-red-500 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
							placeholder="Enter your name"
						/>
					</div>

					<!-- Color picker -->
					<div>
						<label class="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Snake Color
						</label>
						<div class="flex flex-wrap justify-center gap-2.5">
							{#each PRESET_COLORS as color}
								{@const isSelected = selectedColor === color.hex}
								<button
									type="button"
									onclick={() => (selectedColor = color.hex)}
									class="relative h-10 w-10 shrink-0 cursor-pointer rounded-full transition-all duration-150 {isSelected
										? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
										: 'opacity-60 hover:opacity-100 hover:scale-105'}"
									style="background-color: {color.hex}; {isSelected ? `box-shadow: 0 0 0 2px ${color.hex}` : ''}"
									aria-label="Select {color.name}"
								>
									{#if isSelected}
										<svg class="absolute inset-0 m-auto h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					</div>

					<!-- Snake preview -->
					<div class="flex items-center justify-center gap-1 py-3">
						{#each Array(7) as _, i}
							{@const size = i === 0 ? 22 : Math.max(10, 18 - i * 1.2)}
							{@const isStripe = selectedPattern === 'striped' && i % 2 === 1}
							{@const isDotted = selectedPattern === 'dotted' && i % 3 === 0}
							<div
								class="rounded-full"
								style="width: {size}px; height: {size}px; background-color: {isDotted ? '#fff' : isStripe ? selectedColor + '99' : selectedColor}; opacity: {1 - i * 0.1}; {selectedPattern === 'neon' ? `box-shadow: 0 0 6px ${selectedColor}` : ''}"
							></div>
						{/each}
					</div>

					<!-- Cosmetics toggle -->
					<button
						type="button"
						onclick={() => (cosmeticsOpen = !cosmeticsOpen)}
						class="flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-100 dark:hover:bg-gray-600"
					>
						<span class="flex items-center gap-2">
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
							</svg>
							Cosmetics
						</span>
						<svg class="h-4 w-4 transition-transform {cosmeticsOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if cosmeticsOpen}
						<div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
							<!-- Pattern -->
							<div>
								<label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
									Pattern
								</label>
								<div class="flex flex-wrap gap-2">
									{#each PATTERN_OPTIONS as opt}
										{@const isActive = selectedPattern === opt.value}
										<button
											type="button"
											onclick={() => (selectedPattern = opt.value)}
											class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all {isActive
												? 'text-white'
												: 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
											style={isActive ? `background-color: ${selectedColor}` : ''}
										>
											{opt.label}
										</button>
									{/each}
								</div>
							</div>

							<!-- Hat -->
							<div>
								<label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
									Hat
								</label>
								<div class="flex flex-wrap gap-2">
									{#each HAT_OPTIONS as opt}
										{@const isActive = selectedHat === opt.value}
										<button
											type="button"
											onclick={() => (selectedHat = opt.value)}
											class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all {isActive
												? 'text-white'
												: 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
											style={isActive ? `background-color: ${selectedColor}` : ''}
										>
											{opt.label}
										</button>
									{/each}
								</div>
							</div>

							<!-- Eyes -->
							<div>
								<label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
									Eyes
								</label>
								<div class="flex flex-wrap gap-2">
									{#each EYES_OPTIONS as opt}
										{@const isActive = selectedEyes === opt.value}
										<button
											type="button"
											onclick={() => (selectedEyes = opt.value)}
											class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all {isActive
												? 'text-white'
												: 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
											style={isActive ? `background-color: ${selectedColor}` : ''}
										>
											{opt.label}
										</button>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Play button -->
					<button
						type="submit"
						disabled={!nameInput.trim()}
						class="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
						style="background: linear-gradient(135deg, {selectedColor}, {selectedColor}cc); box-shadow: 0 4px 14px {selectedColor}40"
					>
						Play
						<svg
							class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M13 7l5 5m0 0l-5 5m5-5H6"
							/>
						</svg>
					</button>
				</form>

				<!-- Controls hint -->
				<p class="mt-5 text-center text-xs text-gray-400 dark:text-gray-500">
					Use <kbd class="rounded border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 font-mono text-gray-500 dark:text-gray-400">WASD</kbd>
					or arrow keys to move
				</p>
			</div>
		</div>
	</section>
{:else}
	<!-- GAME VIEW -->
	<div class="h-[calc(100vh-4rem)]">
		<SnakeGame {playerName} playerColor={selectedColor} {cosmetics} onLeave={leaveGame} />
	</div>
{/if}
</div>
