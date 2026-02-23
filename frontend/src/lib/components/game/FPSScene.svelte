<script lang="ts">
	import { T } from '@threlte/core';
	import type { ArenaConfig } from '$lib/types/fps';

	interface Props {
		arena: ArenaConfig;
	}

	const { arena }: Props = $props();

	const halfW = $derived(arena.width / 2);
	const halfD = $derived(arena.depth / 2);
	const wallH = $derived(arena.height);
	const wallThickness = 1;

	const walls = $derived([
		{ x: 0, y: wallH / 2, z: -halfD, w: arena.width, d: wallThickness },
		{ x: 0, y: wallH / 2, z: halfD, w: arena.width, d: wallThickness },
		{ x: -halfW, y: wallH / 2, z: 0, w: wallThickness, d: arena.depth },
		{ x: halfW, y: wallH / 2, z: 0, w: wallThickness, d: arena.depth },
	]);

	// Cover boxes scattered around the arena
	const covers = [
		{ x: -15, z: -15, w: 4, h: 2.5, d: 4 },
		{ x: 15, z: 15, w: 4, h: 2.5, d: 4 },
		{ x: -20, z: 10, w: 6, h: 2, d: 2 },
		{ x: 20, z: -10, w: 2, h: 2, d: 6 },
		{ x: 0, z: 0, w: 3, h: 3, d: 3 },
		{ x: -10, z: -25, w: 5, h: 1.5, d: 2 },
		{ x: 25, z: 5, w: 2, h: 2.5, d: 5 },
		{ x: -30, z: -5, w: 3, h: 2, d: 3 },
	];
</script>

<!-- Ambient + directional light -->
<T.AmbientLight intensity={0.35} />
<T.DirectionalLight
	position.x={50}
	position.y={80}
	position.z={30}
	intensity={1.2}
	castShadow
/>
<T.HemisphereLight args={['#87ceeb', '#2a2a3e', 0.3]} />

<!-- Floor -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
	<T.PlaneGeometry args={[arena.width, arena.depth]} />
	<T.MeshStandardMaterial color="#2a2a3e" roughness={0.9} />
</T.Mesh>

<!-- Grid lines on floor -->
<T.GridHelper args={[arena.width, arena.width / 5, '#3a3a55', '#333350']} />

<!-- Arena walls -->
{#each walls as wall}
	<T.Mesh position.x={wall.x} position.y={wall.y} position.z={wall.z} castShadow receiveShadow>
		<T.BoxGeometry args={[wall.w, wallH, wall.d]} />
		<T.MeshStandardMaterial color="#1a1a2e" roughness={0.8} />
	</T.Mesh>
{/each}

<!-- Cover boxes -->
{#each covers as box}
	<T.Mesh position.x={box.x} position.y={box.h / 2} position.z={box.z} castShadow receiveShadow>
		<T.BoxGeometry args={[box.w, box.h, box.d]} />
		<T.MeshStandardMaterial color="#252540" roughness={0.7} />
	</T.Mesh>
{/each}

<!-- Fog -->
<T.FogExp2 args={['#0a0a14', 0.008]} />
