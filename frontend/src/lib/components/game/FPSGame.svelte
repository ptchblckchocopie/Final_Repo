<script lang="ts">
	import { onMount } from 'svelte';
	import { Canvas, T } from '@threlte/core';
	import FPSScene from './FPSScene.svelte';
	import FPSPlayer from './FPSPlayer.svelte';
	import FPSEnemies from './FPSEnemies.svelte';
	import FPSHud from './FPSHud.svelte';
	import FPSCrosshair from './FPSCrosshair.svelte';
	import type { ArenaConfig, FPSGameState } from '$lib/types/fps';
	import {
		connectFPS,
		disconnectFPS,
		getFPSConnectionStatus,
		getFPSPlayerId,
		getFPSPlayerCount,
		getFPSPing,
		sendPlayerState,
		sendShoot,
		sendRespawn,
	} from '$lib/stores/fps-ws.svelte';

	interface Props {
		playerName: string;
		playerColor: string;
		onLeave: () => void;
	}

	const { playerName, playerColor, onLeave }: Props = $props();

	let arenaConfig = $state<ArenaConfig>({ width: 100, depth: 100, height: 4 });
	let latestState = $state<FPSGameState | null>(null);
	let isDead = $state(false);
	let gameOver = $state(false);
	let gameOverData = $state<{
		teamScore: number;
		playerScores: { id: string; name: string; score: number; kills: number }[];
	} | null>(null);

	const connStatus = $derived(getFPSConnectionStatus());
	const playerId = $derived(getFPSPlayerId());
	const playerCount = $derived(getFPSPlayerCount());
	const fpsPing = $derived(getFPSPing());

	const myPlayer = $derived(latestState?.players.find((p) => p.id === playerId) ?? null);
	const myHealth = $derived(myPlayer?.health ?? 100);
	const myScore = $derived(myPlayer?.score ?? 0);
	const myKills = $derived(myPlayer?.kills ?? 0);

	// FPS counter
	let fps = $state(0);
	let frameCount = 0;
	let lastFpsTime = 0;

	onMount(() => {
		lastFpsTime = performance.now();

		connectFPS(playerName, playerColor, {
			onJoined(data) {
				arenaConfig = data.arena;
			},
			onState(state) {
				latestState = state;
				if (state.gameOver) {
					gameOver = true;
				}

				// Check if our player died server-side
				const me = state.players.find((p) => p.id === playerId);
				if (me && !me.alive) {
					isDead = true;
				} else if (me && me.alive) {
					isDead = false;
				}

				// FPS counting
				frameCount++;
				const now = performance.now();
				if (now - lastFpsTime >= 1000) {
					fps = frameCount;
					frameCount = 0;
					lastFpsTime = now;
				}
			},
			onHit() {},
			onPlayerHit() {},
			onPlayerDied(data) {
				if (data.playerId === playerId) {
					isDead = true;
				}
			},
			onWaveStart() {},
			onWaveComplete() {},
			onGameOver(data) {
				gameOver = true;
				gameOverData = data;
			},
			onPlayerCount() {},
		});

		return () => {
			disconnectFPS();
		};
	});

	function handleLeave() {
		disconnectFPS();
		onLeave();
	}

	function handleRespawn() {
		sendRespawn();
		isDead = false;
	}

	function handlePlayAgain() {
		gameOver = false;
		gameOverData = null;
		isDead = false;
		sendRespawn();
	}
</script>

<div class="relative h-full w-full overflow-hidden bg-black">
	<!-- 3D Canvas -->
	<Canvas>
		<FPSScene arena={arenaConfig} />
		<FPSPlayer
			{playerId}
			gameState={latestState}
			arena={arenaConfig}
			{sendPlayerState}
			{sendShoot}
		/>
		<FPSEnemies enemies={latestState?.enemies ?? []} />

		<!-- Render other players as colored boxes -->
		{#each (latestState?.players ?? []).filter((p) => p.id !== playerId && p.alive) as player (player.id)}
			<T.Mesh
				position.x={player.position.x}
				position.y={1}
				position.z={player.position.z}
				castShadow
			>
				<T.BoxGeometry args={[0.8, 2, 0.8]} />
				<T.MeshStandardMaterial color={player.color} />
			</T.Mesh>
		{/each}
	</Canvas>

	<!-- Crosshair -->
	<FPSCrosshair />

	<!-- HUD -->
	<FPSHud
		health={myHealth}
		wave={latestState?.wave ?? null}
		score={myScore}
		kills={myKills}
		teamScore={latestState?.teamScore ?? 0}
		{playerCount}
		{fps}
		ping={fpsPing}
	/>

	<!-- Connection status -->
	{#if connStatus !== 'connected'}
		<div
			class="absolute top-4 left-1/2 -translate-x-1/2 rounded-lg bg-yellow-500/90 px-4 py-2 text-sm font-medium text-black"
		>
			{connStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
		</div>
	{/if}

	<!-- Death overlay -->
	{#if isDead && !gameOver}
		<div class="absolute inset-0 flex items-center justify-center bg-black/70">
			<div class="text-center">
				<p class="mb-4 text-4xl font-bold text-red-500">YOU DIED</p>
				<button
					onclick={handleRespawn}
					class="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
				>
					Respawn
				</button>
			</div>
		</div>
	{/if}

	<!-- Game over overlay -->
	{#if gameOver && gameOverData}
		<div class="absolute inset-0 flex items-center justify-center bg-black/80">
			<div class="w-80 rounded-2xl bg-slate-800 p-6 text-center">
				<p class="mb-2 text-3xl font-bold text-red-500">GAME OVER</p>
				<p class="mb-4 text-lg text-gray-300">
					Team Score: <span class="font-bold text-white">{gameOverData.teamScore}</span>
				</p>
				<div class="mb-4 space-y-1 text-sm text-gray-400">
					{#each gameOverData.playerScores as ps}
						<div class="flex justify-between">
							<span>{ps.name}</span>
							<span>{ps.kills} kills / {ps.score} pts</span>
						</div>
					{/each}
				</div>
				<div class="flex gap-2">
					<button
						onclick={handlePlayAgain}
						class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
					>
						Play Again
					</button>
					<button
						onclick={handleLeave}
						class="flex-1 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-500"
					>
						Leave
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Leave button -->
	{#if !gameOver}
		<button
			onclick={handleLeave}
			class="absolute top-4 right-4 rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-slate-700"
		>
			Leave
		</button>
	{/if}
</div>
