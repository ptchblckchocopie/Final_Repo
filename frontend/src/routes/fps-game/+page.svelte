<script lang="ts">
	import { onMount } from 'svelte';
	import FPSGame from '$lib/components/game/FPSGame.svelte';
	import { getIsDark } from '$lib/stores/theme.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

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
	let inGame = $state(false);
	const isDark = $derived(getIsDark());

	onMount(() => {
		const savedName = localStorage.getItem('fps-game-name');
		const savedColor = localStorage.getItem('fps-game-color');
		if (savedName) nameInput = savedName;
		if (savedColor && PRESET_COLORS.some((c) => c.hex === savedColor)) selectedColor = savedColor;
	});

	function joinGame(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = nameInput.trim();
		if (!trimmed) return;
		playerName = trimmed;
		localStorage.setItem('fps-game-name', trimmed);
		localStorage.setItem('fps-game-color', selectedColor);
		inGame = true;
	}

	function leaveGame() {
		inGame = false;
		playerName = '';
	}
</script>

<svelte:head>
	<title>FPS Game - Veent Tix</title>
</svelte:head>

<div class:dark={isDark}>
	{#if !inGame}
		<!-- HERO SECTION -->
		<section class="relative overflow-hidden bg-slate-900 py-24 text-white">
			<div
				class="absolute inset-0 bg-gradient-to-br from-red-600/15 via-transparent to-orange-600/10"
			></div>
			<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="mx-auto max-w-3xl text-center">
					<p class="mb-4 text-sm font-semibold uppercase tracking-wider text-orange-400">
						Multiplayer Co-op
					</p>
					<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">
						Wave Survival FPS
					</h1>
					<p class="mt-6 text-lg leading-relaxed text-gray-400">
						Team up and survive endless waves of enemies. How long can you hold?
					</p>
				</div>
			</div>
		</section>

		<!-- FORM SECTION -->
		<section class="bg-white py-20 dark:bg-gray-900">
			<div class="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
				<div
					class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800"
				>
					<!-- Theme toggle -->
					<div class="-mr-2 -mt-2 mb-2 flex justify-end">
						<ThemeToggle />
					</div>

					<div
						class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-orange-500/25"
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
								d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
							/>
						</svg>
					</div>

					<h2 class="text-center text-xl font-bold text-gray-900 dark:text-gray-100">
						Deploy to Arena
					</h2>
					<p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
						Pick a callsign and color, then fight waves of enemies
					</p>

					<form onsubmit={joinGame} class="mt-6 space-y-5">
						<!-- Name input -->
						<div>
							<label
								for="fps-name"
								class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Callsign
							</label>
							<input
								id="fps-name"
								type="text"
								bind:value={nameInput}
								required
								maxlength={20}
								class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:bg-gray-600"
								placeholder="Enter your callsign"
							/>
						</div>

						<!-- Color picker -->
						<div>
							<label
								class="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Player Color
							</label>
							<div class="flex flex-wrap justify-center gap-2.5">
								{#each PRESET_COLORS as color}
									{@const isSelected = selectedColor === color.hex}
									<button
										type="button"
										onclick={() => (selectedColor = color.hex)}
										class="relative h-10 w-10 shrink-0 cursor-pointer rounded-full transition-all duration-150 {isSelected
											? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
											: 'opacity-60 hover:scale-105 hover:opacity-100'}"
										style="background-color: {color.hex}; {isSelected
											? `box-shadow: 0 0 0 2px ${color.hex}`
											: ''}"
										aria-label="Select {color.name}"
									>
										{#if isSelected}
											<svg
												class="absolute inset-0 m-auto h-4 w-4 text-white"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="3"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M5 13l4 4L19 7"
												/>
											</svg>
										{/if}
									</button>
								{/each}
							</div>
						</div>

						<!-- Deploy button -->
						<button
							type="submit"
							disabled={!nameInput.trim()}
							class="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
							style="background: linear-gradient(135deg, {selectedColor}, {selectedColor}cc); box-shadow: 0 4px 14px {selectedColor}40"
						>
							Deploy
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
					<div class="mt-5 text-center text-xs text-gray-400 dark:text-gray-500">
						<p>
							<kbd
								class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
								>WASD</kbd
							> to move &middot;
							<kbd
								class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
								>Mouse</kbd
							> to aim &middot;
							<kbd
								class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
								>Click</kbd
							> to shoot
						</p>
					</div>
				</div>
			</div>
		</section>
	{:else}
		<!-- GAME VIEW -->
		<div class="h-[calc(100vh-4rem)]">
			<FPSGame {playerName} playerColor={selectedColor} onLeave={leaveGame} />
		</div>
	{/if}
</div>
