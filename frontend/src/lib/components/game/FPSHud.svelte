<script lang="ts">
	import type { WaveInfo } from '$lib/types/fps';

	interface Props {
		health: number;
		wave: WaveInfo | null;
		score: number;
		kills: number;
		teamScore: number;
		playerCount: number;
		fps: number;
		ping: number;
	}

	const { health, wave, score, kills, teamScore, playerCount, fps, ping }: Props = $props();

	const healthColor = $derived(
		health > 60 ? 'bg-green-500' : health > 30 ? 'bg-yellow-500' : 'bg-red-500',
	);
</script>

<div class="pointer-events-none absolute inset-0">
	<!-- Top-left: Health -->
	<div class="absolute top-4 left-4 space-y-1">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
				<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
			</svg>
			<div class="h-3 w-32 overflow-hidden rounded-full bg-gray-700">
				<div
					class="h-full rounded-full transition-all duration-300 {healthColor}"
					style="width: {health}%"
				></div>
			</div>
			<span class="text-xs font-bold text-white">{health}</span>
		</div>
	</div>

	<!-- Top-center: Wave info -->
	{#if wave}
		<div class="absolute top-4 left-1/2 -translate-x-1/2 text-center">
			{#if wave.state === 'countdown'}
				<p class="text-lg font-bold text-yellow-400">
					Wave {wave.number + 1} in {wave.countdownSeconds}s
				</p>
			{:else if wave.state === 'active'}
				<p class="text-sm font-semibold text-white">
					Wave {wave.number}
				</p>
				<p class="text-xs text-gray-400">
					{wave.enemiesRemaining} / {wave.totalEnemies} remaining
				</p>
			{:else}
				<p class="text-sm font-semibold text-green-400">Wave {wave.number} Complete!</p>
			{/if}
		</div>
	{/if}

	<!-- Bottom-left: Score -->
	<div class="absolute bottom-4 left-4 space-y-0.5">
		<p class="text-xs text-gray-400">
			Score: <span class="font-bold text-white">{score}</span>
		</p>
		<p class="text-xs text-gray-400">
			Kills: <span class="font-bold text-white">{kills}</span>
		</p>
		<p class="text-xs text-gray-400">
			Team: <span class="font-bold text-white">{teamScore}</span>
		</p>
	</div>

	<!-- Bottom-right: Stats -->
	<div class="absolute bottom-4 right-4 text-right space-y-0.5">
		<p class="text-xs text-gray-500">
			{playerCount} player{playerCount !== 1 ? 's' : ''}
		</p>
		<p class="text-xs text-gray-500">
			{fps} fps | {ping}ms
		</p>
	</div>
</div>
