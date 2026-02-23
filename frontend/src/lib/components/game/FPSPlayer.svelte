<script lang="ts">
	import { T, useThrelte, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import { onMount } from 'svelte';
	import type { ArenaConfig, FPSGameState, Vec3 } from '$lib/types/fps';

	interface Props {
		playerId: string;
		gameState: FPSGameState | null;
		arena: ArenaConfig;
		sendPlayerState: (position: Vec3, rotation: { yaw: number; pitch: number }) => void;
		sendShoot: (origin: Vec3, direction: Vec3) => void;
	}

	const { playerId, gameState, arena, sendPlayerState, sendShoot }: Props = $props();

	let camera = $state<THREE.PerspectiveCamera | undefined>(undefined);
	let isLocked = $state(false);
	let yaw = 0;
	let pitch = 0;

	const MOVE_SPEED = 8;
	const MOUSE_SENSITIVITY = 0.002;
	const SHOOT_COOLDOWN = 200;
	const EYE_HEIGHT = 1.7;

	const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };
	let playerPos = new THREE.Vector3(0, EYE_HEIGHT, 0);
	let lastShootTime = 0;

	const halfW = $derived(arena.width / 2 - 1);
	const halfD = $derived(arena.depth / 2 - 1);

	const { renderer } = useThrelte();

	let muzzleFlash = $state(false);

	onMount(() => {
		const domEl = renderer.domElement;

		function onClick() {
			if (!isLocked) {
				domEl.requestPointerLock();
			}
		}

		function onPointerLockChange() {
			isLocked = document.pointerLockElement === domEl;
		}

		function onMouseMove(e: MouseEvent) {
			if (!isLocked) return;
			yaw -= e.movementX * MOUSE_SENSITIVITY;
			pitch -= e.movementY * MOUSE_SENSITIVITY;
			pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
		}

		function onMouseDown(e: MouseEvent) {
			if (!isLocked || e.button !== 0) return;
			const now = performance.now();
			if (now - lastShootTime < SHOOT_COOLDOWN) return;
			lastShootTime = now;

			const dir = new THREE.Vector3(0, 0, -1);
			const qYaw = new THREE.Quaternion().setFromAxisAngle(
				new THREE.Vector3(0, 1, 0),
				yaw,
			);
			const qPitch = new THREE.Quaternion().setFromAxisAngle(
				new THREE.Vector3(1, 0, 0),
				pitch,
			);
			dir.applyQuaternion(qPitch).applyQuaternion(qYaw);

			sendShoot(
				{ x: playerPos.x, y: playerPos.y, z: playerPos.z },
				{ x: dir.x, y: dir.y, z: dir.z },
			);

			muzzleFlash = true;
			setTimeout(() => (muzzleFlash = false), 80);
		}

		function onKeyDown(e: KeyboardEvent) {
			const key = e.key.toLowerCase();
			if (key in keys) keys[key] = true;
		}

		function onKeyUp(e: KeyboardEvent) {
			const key = e.key.toLowerCase();
			if (key in keys) keys[key] = false;
		}

		domEl.addEventListener('click', onClick);
		document.addEventListener('pointerlockchange', onPointerLockChange);
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mousedown', onMouseDown);
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('keyup', onKeyUp);

		return () => {
			domEl.removeEventListener('click', onClick);
			document.removeEventListener('pointerlockchange', onPointerLockChange);
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mousedown', onMouseDown);
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('keyup', onKeyUp);
			if (document.pointerLockElement === domEl) {
				document.exitPointerLock();
			}
		};
	});

	useTask((delta) => {
		if (!camera) return;

		const qYaw = new THREE.Quaternion().setFromAxisAngle(
			new THREE.Vector3(0, 1, 0),
			yaw,
		);
		const qPitch = new THREE.Quaternion().setFromAxisAngle(
			new THREE.Vector3(1, 0, 0),
			pitch,
		);
		camera.quaternion.copy(qYaw).multiply(qPitch);

		if (isLocked) {
			const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(qYaw);
			const right = new THREE.Vector3(1, 0, 0).applyQuaternion(qYaw);
			const moveDir = new THREE.Vector3();

			if (keys.w) moveDir.add(forward);
			if (keys.s) moveDir.sub(forward);
			if (keys.d) moveDir.add(right);
			if (keys.a) moveDir.sub(right);

			if (moveDir.lengthSq() > 0) {
				moveDir.normalize().multiplyScalar(MOVE_SPEED * delta);
				playerPos.add(moveDir);
				playerPos.x = Math.max(-halfW, Math.min(halfW, playerPos.x));
				playerPos.z = Math.max(-halfD, Math.min(halfD, playerPos.z));
			}
		}

		camera.position.copy(playerPos);

		sendPlayerState(
			{ x: playerPos.x, y: playerPos.y, z: playerPos.z },
			{ yaw, pitch },
		);
	});
</script>

<T.PerspectiveCamera
	bind:ref={camera}
	makeDefault={true}
	fov={75}
	near={0.1}
	far={500}
	position.x={0}
	position.y={EYE_HEIGHT}
	position.z={0}
/>

{#if muzzleFlash}
	<T.PointLight
		position.x={playerPos.x}
		position.y={playerPos.y}
		position.z={playerPos.z}
		intensity={5}
		distance={10}
		color="#ffaa00"
	/>
{/if}
