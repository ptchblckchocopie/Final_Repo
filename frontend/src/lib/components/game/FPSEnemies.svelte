<script lang="ts">
	import { T } from '@threlte/core';
	import type { FPSEnemyData, EnemyType } from '$lib/types/fps';

	interface Props {
		enemies: FPSEnemyData[];
	}

	const { enemies }: Props = $props();

	const aliveEnemies = $derived(enemies.filter((e) => e.alive));

	const ENEMY_VISUALS: Record<EnemyType, { color: string; w: number; h: number; d: number }> = {
		grunt: { color: '#ef4444', w: 0.8, h: 1.8, d: 0.8 },
		brute: { color: '#7c3aed', w: 1.2, h: 2.2, d: 1.2 },
		sprinter: { color: '#f59e0b', w: 0.6, h: 1.5, d: 0.6 },
	};
</script>

{#each aliveEnemies as enemy (enemy.id)}
	{@const vis = ENEMY_VISUALS[enemy.type]}
	{@const healthPct = enemy.health / enemy.maxHealth}
	<T.Group position.x={enemy.position.x} position.y={0} position.z={enemy.position.z}>
		<!-- Body -->
		<T.Mesh position.y={vis.h / 2} castShadow>
			<T.BoxGeometry args={[vis.w, vis.h, vis.d]} />
			<T.MeshStandardMaterial color={vis.color} />
		</T.Mesh>

		<!-- Eyes (two small white cubes) -->
		<T.Mesh position.x={-0.15} position.y={vis.h - 0.3} position.z={-vis.d / 2 - 0.01}>
			<T.BoxGeometry args={[0.12, 0.12, 0.05]} />
			<T.MeshBasicMaterial color="#ffffff" />
		</T.Mesh>
		<T.Mesh position.x={0.15} position.y={vis.h - 0.3} position.z={-vis.d / 2 - 0.01}>
			<T.BoxGeometry args={[0.12, 0.12, 0.05]} />
			<T.MeshBasicMaterial color="#ffffff" />
		</T.Mesh>

		<!-- Health bar background -->
		<T.Mesh position.y={vis.h + 0.4}>
			<T.PlaneGeometry args={[1, 0.12]} />
			<T.MeshBasicMaterial color="#333333" />
		</T.Mesh>

		<!-- Health bar fill -->
		<T.Mesh position.x={(healthPct - 1) * 0.5} position.y={vis.h + 0.4} position.z={0.001}>
			<T.PlaneGeometry args={[healthPct, 0.1]} />
			<T.MeshBasicMaterial color={healthPct > 0.5 ? '#22c55e' : healthPct > 0.25 ? '#f59e0b' : '#ef4444'} />
		</T.Mesh>
	</T.Group>
{/each}
