<script lang="ts">
	import { onMount } from 'svelte';
	import type { SnakeGameState, SnakeData, FoodData, SnakeCosmetics } from '$lib/types/snake';
	import { DEFAULT_COSMETICS } from '$lib/types/snake';
	import {
		connectGame,
		disconnectGame,
		sendDirection,
		sendRespawn,
		getPlayerId,
		getPlayerCount,
		getGameConnectionStatus,
		getPing,
	} from '$lib/stores/snake-ws.svelte';

	interface Props {
		playerName: string;
		playerColor: string;
		cosmetics?: SnakeCosmetics;
		onLeave: () => void;
	}

	const { playerName, playerColor, cosmetics = DEFAULT_COSMETICS, onLeave }: Props = $props();

	let canvas = $state<HTMLCanvasElement>(undefined!);
	let animFrame = 0;

	let latestState: SnakeGameState | null = null;
	let localPlayerId = '';
	let localMapSize = 2000;

	// Smooth chase: per-snake rendered positions
	const smoothPositions = new Map<string, { x: number; y: number }[]>();
	let lastRenderTime = 0;

	let playerCount = $derived(getPlayerCount());
	let connStatus = $derived(getGameConnectionStatus());

	let cameraX = 0;
	let cameraY = 0;
	let isDead = $state(false);
	let myScore = $state(0);
	let isMobile = $state(false);

	const GRID = 20;
	let frameTime = 0;

	// FPS tracking
	let fps = $state(0);
	let fpsFrameCount = 0;
	let fpsLastTime = 0;

	// Pre-cached offscreen canvases for expensive things
	let vignetteCanvas: HTMLCanvasElement | null = null;
	let lastVignetteW = 0;
	let lastVignetteH = 0;

	function hexToRgb(hex: string): [number, number, number] {
		const n = parseInt(hex.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}

	function buildVignette(w: number, h: number): HTMLCanvasElement {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
		g.addColorStop(0, 'rgba(0,0,0,0)');
		g.addColorStop(1, 'rgba(0,0,0,0.3)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		return c;
	}

	onMount(() => {
		isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		connectGame(playerName, playerColor, cosmetics, {
			onJoined(data) {
				localPlayerId = data.playerId;
				localMapSize = data.mapSize;
			},
			onState(state) {
				latestState = state;
				const me = state.snakes.find((s) => s.id === localPlayerId);
				if (me) myScore = me.score;
			},
			onDied(data) {
				if (data.playerId === localPlayerId) {
					isDead = true;
					// Clear smooth positions so respawn snaps to new location
					smoothPositions.delete(localPlayerId);
				}
			},
			onRespawned(data) {
				if (data.playerId === localPlayerId) {
					isDead = false;
					// Clear smooth positions so we snap to new spawn location
					smoothPositions.delete(localPlayerId);
				}
			},
			onPlayerCount() {},
		});

		const ctx = canvas.getContext('2d')!;
		resizeCanvas();

		function resizeCanvas() {
			if (!canvas) return;
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		}

		function renderLoop(now: number) {
			frameTime = now * 0.001;

			// FPS counter
			fpsFrameCount++;
			if (now - fpsLastTime >= 1000) {
				fps = fpsFrameCount;
				fpsFrameCount = 0;
				fpsLastTime = now;
			}

			const w = canvas.width;
			const h = canvas.height;

			ctx.fillStyle = '#080c14';
			ctx.fillRect(0, 0, w, h);

			// Compute dt once before anything else uses lastRenderTime
			const dt = lastRenderTime > 0 ? (now - lastRenderTime) / 1000 : 0.016;

			const status = getGameConnectionStatus();
			const pid = localPlayerId;
			const state = getSmoothState(now); // this updates lastRenderTime

			if (!state || !pid) {
				ctx.fillStyle = '#64748b';
				ctx.font = '500 16px system-ui, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				const msg =
					status === 'connecting'
						? 'Connecting...'
						: status === 'disconnected'
							? 'Disconnected \u2014 Retrying...'
							: 'Joining game...';
				ctx.fillText(msg, w / 2, h / 2);
				animFrame = requestAnimationFrame(renderLoop);
				return;
			}

			// Camera: frame-rate-independent smooth follow
			const me = state.snakes.find((s) => s.id === pid);
			if (me && me.segments.length > 0) {
				const tx = me.segments[0].x - w / 2;
				const ty = me.segments[0].y - h / 2;
				const camFactor = 1 - Math.exp(-10 * dt);
				cameraX += (tx - cameraX) * camFactor;
				cameraY += (ty - cameraY) * camFactor;
			}

			ctx.save();
			ctx.translate(-cameraX, -cameraY);

			drawDotGrid(ctx, w, h);
			drawBorder(ctx);

			for (const food of state.food) {
				drawFood(ctx, food);
			}

			// Draw other snakes first, then self on top
			for (const snake of state.snakes) {
				if (!snake.alive || snake.segments.length === 0 || snake.id === pid) continue;
				drawSnake(ctx, snake, false);
			}
			if (me && me.alive && me.segments.length > 0) {
				drawSnake(ctx, me, true);
			}

			ctx.restore();

			// Vignette (pre-cached)
			if (!vignetteCanvas || lastVignetteW !== w || lastVignetteH !== h) {
				vignetteCanvas = buildVignette(w, h);
				lastVignetteW = w;
				lastVignetteH = h;
			}
			ctx.drawImage(vignetteCanvas, 0, 0);

			drawMinimap(ctx, state, w, h, pid);

			animFrame = requestAnimationFrame(renderLoop);
		}

		animFrame = requestAnimationFrame(renderLoop);
		window.addEventListener('resize', resizeCanvas);
		window.addEventListener('keydown', handleKeydown);

		return () => {
			cancelAnimationFrame(animFrame);
			window.removeEventListener('resize', resizeCanvas);
			window.removeEventListener('keydown', handleKeydown);
			disconnectGame();
		};
	});

	function handleKeydown(e: KeyboardEvent) {
		const keyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
			ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
			w: 'up', W: 'up', s: 'down', S: 'down',
			a: 'left', A: 'left', d: 'right', D: 'right',
		};
		const dir = keyMap[e.key];
		if (dir) {
			e.preventDefault();
			sendDirection(dir);
		}
	}

	function handleDirection(dir: 'up' | 'down' | 'left' | 'right') {
		sendDirection(dir);
	}

	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	function getSmoothState(now: number): SnakeGameState | null {
		if (!latestState) return null;

		const dt = lastRenderTime > 0 ? (now - lastRenderTime) / 1000 : 0.016;
		lastRenderTime = now;

		// Exponential smoothing: converge ~90% within one server tick (~66ms)
		const smoothFactor = 1 - Math.exp(-20 * dt);

		const snakes: SnakeData[] = latestState.snakes.map((snake) => {
			let smooth = smoothPositions.get(snake.id);

			// First time or dead snake: snap to server position
			if (!smooth || !snake.alive) {
				smooth = snake.segments.map((s) => ({ x: s.x, y: s.y }));
				smoothPositions.set(snake.id, smooth);
				return snake;
			}

			// Match segment count (growth or shrink)
			while (smooth.length < snake.segments.length) {
				const src = snake.segments[smooth.length];
				smooth.push({ x: src.x, y: src.y });
			}
			if (smooth.length > snake.segments.length) {
				smooth.length = snake.segments.length;
			}

			// Smoothly chase each segment toward its server target
			const segments = smooth.map((s, i) => {
				s.x += (snake.segments[i].x - s.x) * smoothFactor;
				s.y += (snake.segments[i].y - s.y) * smoothFactor;
				return { x: s.x, y: s.y };
			});

			return { ...snake, segments };
		});

		// Clean up disconnected snakes
		for (const id of smoothPositions.keys()) {
			if (!latestState.snakes.some((s) => s.id === id)) {
				smoothPositions.delete(id);
			}
		}

		return { ...latestState, snakes };
	}

	// --- Dot grid (lightweight) ---
	function drawDotGrid(c: CanvasRenderingContext2D, vw: number, vh: number) {
		const sp = 40;
		const sx = Math.max(0, Math.floor(cameraX / sp) * sp);
		const ex = Math.min(localMapSize, cameraX + vw + sp);
		const sy = Math.max(0, Math.floor(cameraY / sp) * sp);
		const ey = Math.min(localMapSize, cameraY + vh + sp);

		c.fillStyle = 'rgba(148,163,184,0.06)';
		for (let x = sx; x <= ex; x += sp) {
			for (let y = sy; y <= ey; y += sp) {
				c.fillRect(x - 0.5, y - 0.5, 1, 1);
			}
		}
	}

	// --- Border: simple glow line, no gradients ---
	function drawBorder(c: CanvasRenderingContext2D) {
		const pulse = 0.5 + Math.sin(frameTime * 2) * 0.2;

		// Outer border (slightly transparent)
		c.strokeStyle = `rgba(239,68,68,${0.3 + pulse * 0.2})`;
		c.lineWidth = 3;
		c.strokeRect(0, 0, localMapSize, localMapSize);

		// Inner border accent
		c.strokeStyle = `rgba(239,68,68,${0.08 + pulse * 0.05})`;
		c.lineWidth = 20;
		c.strokeRect(10, 10, localMapSize - 20, localMapSize - 20);
	}

	// --- Food: simple circle + highlight dot (NO shadow, NO gradient) ---
	function drawFood(c: CanvasRenderingContext2D, food: FoodData) {
		const pulse = 0.85 + Math.sin(frameTime * 3.5 + food.x * 0.05 + food.y * 0.05) * 0.15;
		const r = 5 * pulse;

		// Outer glow ring (cheap: just a larger, transparent circle)
		c.fillStyle = 'rgba(251,191,36,0.15)';
		c.beginPath();
		c.arc(food.x, food.y, r + 4, 0, Math.PI * 2);
		c.fill();

		// Core
		c.fillStyle = '#f59e0b';
		c.beginPath();
		c.arc(food.x, food.y, r, 0, Math.PI * 2);
		c.fill();

		// Bright center
		c.fillStyle = '#fef3c7';
		c.beginPath();
		c.arc(food.x, food.y, r * 0.4, 0, Math.PI * 2);
		c.fill();
	}

	// --- Pattern helpers ---
	function getSegmentColor(snake: SnakeData, i: number, t: number, r: number, g: number, b: number): string {
		const pattern = snake.cosmetics?.pattern || 'solid';
		const alpha = 0.4 + t * 0.6;
		switch (pattern) {
			case 'striped':
				if (i % 2 === 0) return `rgba(${r},${g},${b},${alpha})`;
				return `rgba(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 60, 255)},${alpha})`;
			case 'neon':
				return `rgba(${r},${g},${b},${0.7 + Math.sin(frameTime * 4 + i * 0.5) * 0.3})`;
			case 'rainbow': {
				const hue = (i * 25 + frameTime * 60) % 360;
				return `hsla(${hue},85%,55%,${alpha})`;
			}
			case 'dotted':
				if (i % 3 === 0) return `rgba(255,255,255,${alpha * 0.7})`;
				return `rgba(${r},${g},${b},${alpha})`;
			default: // solid
				return `rgba(${r},${g},${b},${alpha})`;
		}
	}

	// --- Snake: smooth body + detailed head ---
	function drawSnake(c: CanvasRenderingContext2D, snake: SnakeData, isMe: boolean) {
		const segs = snake.segments;
		const color = snake.color;
		const [r, g, b] = hexToRgb(color);

		// Outline glow for player (drawn first, underneath)
		if (isMe && segs.length > 1) {
			c.globalAlpha = 0.15;
			for (let i = segs.length - 1; i >= 1; i--) {
				const seg = segs[i];
				const next = segs[i - 1];
				const t = 1 - i / segs.length;
				const radius = lerp(6, 14, t);
				c.strokeStyle = color;
				c.lineWidth = radius * 2;
				c.lineCap = 'round';
				c.beginPath();
				c.moveTo(seg.x, seg.y);
				c.lineTo(next.x, next.y);
				c.stroke();
			}
			c.globalAlpha = 1;
		}

		// Body: draw thick rounded lines back-to-front
		for (let i = segs.length - 1; i >= 1; i--) {
			const seg = segs[i];
			const next = segs[i - 1];
			const t = 1 - i / segs.length;
			const radius = lerp(4, isMe ? 10 : 9, t);

			c.strokeStyle = getSegmentColor(snake, i, t, r, g, b);
			c.lineWidth = radius * 2;
			c.lineCap = 'round';
			c.beginPath();
			c.moveTo(seg.x, seg.y);
			c.lineTo(next.x, next.y);
			c.stroke();
		}

		// Center highlight stripe
		if (segs.length > 2) {
			for (let i = segs.length - 1; i >= 1; i--) {
				const seg = segs[i];
				const next = segs[i - 1];
				const t = 1 - i / segs.length;
				const radius = lerp(1, isMe ? 3 : 2.5, t);

				c.strokeStyle = `rgba(255,255,255,${0.04 + t * 0.08})`;
				c.lineWidth = radius * 2;
				c.lineCap = 'round';
				c.beginPath();
				c.moveTo(seg.x, seg.y);
				c.lineTo(next.x, next.y);
				c.stroke();
			}
		}

		// Head
		drawSnakeHead(c, snake, isMe, r, g, b);

		// Hat (drawn on top of head)
		drawHat(c, snake);

		// Name label
		const head = segs[0];
		const hatOffset = (snake.cosmetics?.hat && snake.cosmetics.hat !== 'none') ? 10 : 0;
		c.font = 'bold 11px system-ui, sans-serif';
		c.textAlign = 'center';
		c.textBaseline = 'middle';

		const nameW = c.measureText(snake.name).width + 12;
		const pillH = 18;
		const pillX = head.x - nameW / 2;
		const pillY = head.y - 30 - hatOffset - pillH / 2;

		c.fillStyle = 'rgba(0,0,0,0.5)';
		c.beginPath();
		c.roundRect(pillX, pillY, nameW, pillH, 5);
		c.fill();

		c.fillStyle = isMe ? '#fff' : '#cbd5e1';
		c.fillText(snake.name, head.x, pillY + pillH / 2);

		if (snake.score > 0) {
			c.font = '600 9px system-ui, sans-serif';
			c.fillStyle = '#fbbf24';
			c.fillText(`${snake.score}`, head.x, pillY - 8);
		}
	}

	function drawSnakeHead(c: CanvasRenderingContext2D, snake: SnakeData, isMe: boolean, r: number, g: number, b: number) {
		const head = snake.segments[0];
		const color = snake.color;
		const hr = isMe ? 11 : 10;
		const dir = snake.direction;
		let dx = 0, dy = 0;
		if (dir === 'up') dy = -1;
		else if (dir === 'down') dy = 1;
		else if (dir === 'left') dx = -1;
		else if (dir === 'right') dx = 1;

		// Head body
		c.fillStyle = color;
		c.beginPath();
		c.arc(head.x, head.y, hr, 0, Math.PI * 2);
		c.fill();

		// Neon pattern glow on head
		if (snake.cosmetics?.pattern === 'neon') {
			c.strokeStyle = `rgba(${r},${g},${b},${0.5 + Math.sin(frameTime * 4) * 0.3})`;
			c.lineWidth = 2;
			c.beginPath();
			c.arc(head.x, head.y, hr + 1, 0, Math.PI * 2);
			c.stroke();
		}

		// Lighter highlight on front half
		c.fillStyle = `rgba(255,255,255,0.15)`;
		c.beginPath();
		c.arc(head.x + dx * 2, head.y + dy * 2, hr * 0.7, 0, Math.PI * 2);
		c.fill();

		// Player ring
		if (isMe) {
			c.strokeStyle = 'rgba(255,255,255,0.25)';
			c.lineWidth = 1.5;
			c.beginPath();
			c.arc(head.x, head.y, hr + 1, 0, Math.PI * 2);
			c.stroke();
		}

		// Eyes
		drawEyes(c, snake, head, dx, dy, isMe);

		// Tongue (flickers)
		if (Math.sin(frameTime * 6) > 0.3) {
			const tx = head.x + dx * (hr + 1);
			const ty = head.y + dy * (hr + 1);
			const tl = 7;
			c.strokeStyle = '#ef4444';
			c.lineWidth = 1.5;
			c.lineCap = 'round';

			c.beginPath();
			c.moveTo(tx, ty);
			c.lineTo(tx + dx * tl, ty + dy * tl);
			c.stroke();

			const fl = 3;
			const fa = 0.4;
			if (dx !== 0) {
				c.beginPath(); c.moveTo(tx + dx * tl, ty + dy * tl); c.lineTo(tx + dx * (tl + fl), ty - fl * fa); c.stroke();
				c.beginPath(); c.moveTo(tx + dx * tl, ty + dy * tl); c.lineTo(tx + dx * (tl + fl), ty + fl * fa); c.stroke();
			} else {
				c.beginPath(); c.moveTo(tx + dx * tl, ty + dy * tl); c.lineTo(tx - fl * fa, ty + dy * (tl + fl)); c.stroke();
				c.beginPath(); c.moveTo(tx + dx * tl, ty + dy * tl); c.lineTo(tx + fl * fa, ty + dy * (tl + fl)); c.stroke();
			}
		}
	}

	// --- Eyes rendering based on cosmetics ---
	function drawEyes(c: CanvasRenderingContext2D, snake: SnakeData, head: {x: number; y: number}, dx: number, dy: number, isMe: boolean) {
		const ef = 3.5;
		const eo = 4;
		let e1x: number, e1y: number, e2x: number, e2y: number;
		if (dx !== 0) {
			e1x = head.x + dx * ef; e1y = head.y - eo;
			e2x = head.x + dx * ef; e2y = head.y + eo;
		} else {
			e1x = head.x - eo; e1y = head.y + dy * ef;
			e2x = head.x + eo; e2y = head.y + dy * ef;
		}

		const eyeStyle = snake.cosmetics?.eyes || 'normal';
		const ps = 1.2;

		switch (eyeStyle) {
			case 'angry': {
				// Angry: narrower, angled brow lines
				c.fillStyle = '#fff';
				c.beginPath(); c.ellipse(e1x, e1y, 3.2, 2.8, 0, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.ellipse(e2x, e2y, 3.2, 2.8, 0, 0, Math.PI * 2); c.fill();
				c.fillStyle = '#1a1a2e';
				c.beginPath(); c.arc(e1x + dx * ps, e1y + dy * ps, 1.8, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(e2x + dx * ps, e2y + dy * ps, 1.8, 0, Math.PI * 2); c.fill();
				// Angry brows
				c.strokeStyle = '#1a1a2e';
				c.lineWidth = 1.5;
				c.lineCap = 'round';
				if (dx !== 0) {
					c.beginPath(); c.moveTo(e1x - 3, e1y - 4); c.lineTo(e1x + 3, e1y - 2.5); c.stroke();
					c.beginPath(); c.moveTo(e2x - 3, e2y + 2.5); c.lineTo(e2x + 3, e2y + 4); c.stroke();
				} else {
					c.beginPath(); c.moveTo(e1x - 4, e1y - 3); c.lineTo(e1x - 2.5, e1y + 3); c.stroke();
					c.beginPath(); c.moveTo(e2x + 2.5, e2y + 3); c.lineTo(e2x + 4, e2y - 3); c.stroke();
				}
				break;
			}
			case 'cute': {
				// Cute: large round eyes with bigger shine
				c.fillStyle = '#111';
				c.beginPath(); c.arc(e1x, e1y, 4, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(e2x, e2y, 4, 0, Math.PI * 2); c.fill();
				c.fillStyle = 'rgba(255,255,255,0.85)';
				c.beginPath(); c.arc(e1x - 1.2, e1y - 1.2, 1.8, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(e2x - 1.2, e2y - 1.2, 1.8, 0, Math.PI * 2); c.fill();
				c.fillStyle = 'rgba(255,255,255,0.5)';
				c.beginPath(); c.arc(e1x + 1.2, e1y + 0.8, 0.8, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(e2x + 1.2, e2y + 0.8, 0.8, 0, Math.PI * 2); c.fill();
				break;
			}
			case 'alien': {
				// Alien: large oval green eyes
				c.fillStyle = '#4ade80';
				c.beginPath(); c.ellipse(e1x, e1y, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.ellipse(e2x, e2y, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
				c.fillStyle = '#000';
				c.beginPath(); c.ellipse(e1x + dx * 0.5, e1y + dy * 0.5, 2.5, 1.5, 0, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.ellipse(e2x + dx * 0.5, e2y + dy * 0.5, 2.5, 1.5, 0, 0, Math.PI * 2); c.fill();
				break;
			}
			case 'cyclops': {
				// Cyclops: single large eye in center
				const cx = (e1x + e2x) / 2;
				const cy = (e1y + e2y) / 2;
				c.fillStyle = '#fff';
				c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fill();
				c.fillStyle = '#1a1a2e';
				c.beginPath(); c.arc(cx + dx * 1.5, cy + dy * 1.5, 2.5, 0, Math.PI * 2); c.fill();
				c.fillStyle = 'rgba(255,255,255,0.7)';
				c.beginPath(); c.arc(cx - 1, cy - 1, 1.2, 0, Math.PI * 2); c.fill();
				break;
			}
			case 'sleepy': {
				// Sleepy: half-closed lines
				c.strokeStyle = '#1a1a2e';
				c.lineWidth = 2;
				c.lineCap = 'round';
				c.beginPath(); c.moveTo(e1x - 3, e1y); c.lineTo(e1x + 3, e1y); c.stroke();
				c.beginPath(); c.moveTo(e2x - 3, e2y); c.lineTo(e2x + 3, e2y); c.stroke();
				// Small lower curve to make them look sleepy
				c.strokeStyle = '#fff';
				c.lineWidth = 1;
				c.beginPath(); c.arc(e1x, e1y + 0.5, 2.5, 0, Math.PI); c.stroke();
				c.beginPath(); c.arc(e2x, e2y + 0.5, 2.5, 0, Math.PI); c.stroke();
				break;
			}
			default: {
				// Normal eyes
				c.fillStyle = '#fff';
				c.beginPath(); c.ellipse(e1x, e1y, 3.2, 3.8, 0, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.ellipse(e2x, e2y, 3.2, 3.8, 0, 0, Math.PI * 2); c.fill();
				c.fillStyle = '#1a1a2e';
				c.beginPath(); c.arc(e1x + dx * ps, e1y + dy * ps, 1.8, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(e2x + dx * ps, e2y + dy * ps, 1.8, 0, Math.PI * 2); c.fill();
				c.fillStyle = 'rgba(255,255,255,0.7)';
				c.beginPath(); c.arc(e1x - 0.7, e1y - 0.8, 0.9, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(e2x - 0.7, e2y - 0.8, 0.9, 0, Math.PI * 2); c.fill();
				break;
			}
		}
	}

	// --- Hat rendering ---
	function drawHat(c: CanvasRenderingContext2D, snake: SnakeData) {
		const hat = snake.cosmetics?.hat;
		if (!hat || hat === 'none') return;
		const head = snake.segments[0];
		const hx = head.x;
		const hy = head.y;

		switch (hat) {
			case 'crown': {
				c.fillStyle = '#fbbf24';
				c.beginPath();
				c.moveTo(hx - 8, hy - 10);
				c.lineTo(hx - 8, hy - 20);
				c.lineTo(hx - 4, hy - 16);
				c.lineTo(hx, hy - 22);
				c.lineTo(hx + 4, hy - 16);
				c.lineTo(hx + 8, hy - 20);
				c.lineTo(hx + 8, hy - 10);
				c.closePath();
				c.fill();
				// Gems
				c.fillStyle = '#ef4444';
				c.beginPath(); c.arc(hx, hy - 14, 1.5, 0, Math.PI * 2); c.fill();
				c.fillStyle = '#3b82f6';
				c.beginPath(); c.arc(hx - 4.5, hy - 13, 1, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(hx + 4.5, hy - 13, 1, 0, Math.PI * 2); c.fill();
				break;
			}
			case 'tophat': {
				// Brim
				c.fillStyle = '#1a1a2e';
				c.beginPath();
				c.ellipse(hx, hy - 10, 12, 3, 0, 0, Math.PI * 2);
				c.fill();
				// Cylinder
				c.fillStyle = '#1a1a2e';
				c.fillRect(hx - 7, hy - 28, 14, 18);
				// Top
				c.beginPath();
				c.ellipse(hx, hy - 28, 7, 2.5, 0, 0, Math.PI * 2);
				c.fill();
				// Band
				c.fillStyle = '#a855f7';
				c.fillRect(hx - 7, hy - 15, 14, 3);
				break;
			}
			case 'party': {
				// Cone
				c.fillStyle = '#ec4899';
				c.beginPath();
				c.moveTo(hx, hy - 28);
				c.lineTo(hx - 8, hy - 10);
				c.lineTo(hx + 8, hy - 10);
				c.closePath();
				c.fill();
				// Stripes on cone
				c.strokeStyle = '#fbbf24';
				c.lineWidth = 1.5;
				c.beginPath(); c.moveTo(hx - 6, hy - 13); c.lineTo(hx - 1, hy - 24); c.stroke();
				c.beginPath(); c.moveTo(hx + 2, hy - 13); c.lineTo(hx + 1, hy - 24); c.stroke();
				// Pom pom
				c.fillStyle = '#fbbf24';
				c.beginPath(); c.arc(hx, hy - 28, 2.5, 0, Math.PI * 2); c.fill();
				break;
			}
			case 'halo': {
				// Golden ring floating above head
				const bobY = Math.sin(frameTime * 2) * 1.5;
				c.strokeStyle = '#fbbf24';
				c.lineWidth = 2;
				c.globalAlpha = 0.8;
				c.beginPath();
				c.ellipse(hx, hy - 18 + bobY, 10, 3.5, 0, 0, Math.PI * 2);
				c.stroke();
				c.globalAlpha = 0.3;
				c.strokeStyle = '#fef3c7';
				c.lineWidth = 4;
				c.beginPath();
				c.ellipse(hx, hy - 18 + bobY, 10, 3.5, 0, 0, Math.PI * 2);
				c.stroke();
				c.globalAlpha = 1;
				break;
			}
			case 'horns': {
				c.fillStyle = '#7f1d1d';
				// Left horn
				c.beginPath();
				c.moveTo(hx - 6, hy - 8);
				c.quadraticCurveTo(hx - 14, hy - 24, hx - 4, hy - 20);
				c.lineTo(hx - 4, hy - 8);
				c.closePath();
				c.fill();
				// Right horn
				c.beginPath();
				c.moveTo(hx + 6, hy - 8);
				c.quadraticCurveTo(hx + 14, hy - 24, hx + 4, hy - 20);
				c.lineTo(hx + 4, hy - 8);
				c.closePath();
				c.fill();
				// Horn tips - lighter
				c.fillStyle = '#991b1b';
				c.beginPath(); c.arc(hx - 9, hy - 19, 2, 0, Math.PI * 2); c.fill();
				c.beginPath(); c.arc(hx + 9, hy - 19, 2, 0, Math.PI * 2); c.fill();
				break;
			}
		}
	}

	// --- Minimap ---
	function drawMinimap(c: CanvasRenderingContext2D, state: SnakeGameState, vw: number, vh: number, pid: string) {
		const sz = 120;
		const mg = 14;
		const mx = vw - sz - mg;
		const my = vh - sz - mg;
		const sc = sz / localMapSize;

		c.fillStyle = 'rgba(8,12,20,0.8)';
		c.beginPath();
		c.roundRect(mx, my, sz, sz, 6);
		c.fill();

		c.strokeStyle = 'rgba(148,163,184,0.15)';
		c.lineWidth = 1;
		c.beginPath();
		c.roundRect(mx, my, sz, sz, 6);
		c.stroke();

		// Food
		c.fillStyle = 'rgba(251,191,36,0.35)';
		for (const f of state.food) {
			c.fillRect(mx + f.x * sc, my + f.y * sc, 1.5, 1.5);
		}

		// Snakes
		for (const snake of state.snakes) {
			if (!snake.alive || snake.segments.length === 0) continue;
			const h = snake.segments[0];
			c.fillStyle = snake.id === pid ? '#fff' : snake.color;
			c.fillRect(mx + h.x * sc - 1.5, my + h.y * sc - 1.5, 3, 3);
		}

		// Viewport
		c.strokeStyle = 'rgba(255,255,255,0.2)';
		c.lineWidth = 1;
		c.strokeRect(mx + cameraX * sc, my + cameraY * sc, vw * sc, vh * sc);
	}

	function handleLeave() {
		disconnectGame();
		onLeave();
	}
</script>

<div class="relative h-full w-full overflow-hidden bg-[#080c14]">
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>

	<!-- HUD -->
	<div class="pointer-events-none absolute top-4 left-4 flex flex-col gap-2">
		<div class="pointer-events-auto rounded-xl border border-slate-800/50 bg-slate-900/70 px-5 py-3 text-white backdrop-blur-md">
			<div class="flex items-baseline gap-1.5">
				<span class="text-2xl font-black tabular-nums">{myScore}</span>
				<span class="text-[10px] font-semibold text-red-400">pts</span>
			</div>
			<div class="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
				<span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
				{playerCount} player{playerCount !== 1 ? 's' : ''}
			</div>
		</div>
		<div class="rounded-lg border border-slate-800/50 bg-slate-900/70 px-3 py-1.5 font-mono text-[11px] text-slate-400 backdrop-blur-md">
			<span class="{fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'}">{fps}</span> fps
			<span class="mx-1.5 text-slate-600">|</span>
			<span class="{getPing() < 80 ? 'text-green-400' : getPing() < 150 ? 'text-yellow-400' : 'text-red-400'}">{getPing()}</span> ms
		</div>
	</div>

	{#if connStatus !== 'connected'}
		<div class="absolute top-4 left-1/2 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-900/40 px-4 py-2 text-sm font-medium text-red-300 backdrop-blur-md">
			{connStatus === 'connecting' ? 'Connecting...' : 'Disconnected \u2014 Retrying...'}
		</div>
	{/if}

	<button
		onclick={handleLeave}
		class="absolute top-4 right-4 cursor-pointer rounded-xl border border-slate-800/50 bg-slate-900/70 px-4 py-2.5 text-sm font-medium text-slate-300 backdrop-blur-md transition-all hover:border-red-500/40 hover:text-red-300"
	>
		Leave
	</button>

	{#if isDead}
		<div class="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
			<div class="text-center">
				<h2 class="text-5xl font-black text-red-400">You Died!</h2>
				<p class="mt-3 text-sm text-slate-400">Score: <span class="font-bold text-white">{myScore}</span></p>
				<button
					onclick={() => sendRespawn()}
					class="mt-6 cursor-pointer rounded-xl bg-red-600 px-8 py-3 text-lg font-bold text-white shadow-lg transition-all hover:bg-red-500 hover:shadow-red-500/25 active:scale-95"
				>
					Respawn
				</button>
			</div>
		</div>
	{/if}

	{#if isMobile}
		<div class="absolute bottom-8 left-1/2 -translate-x-1/2">
			<div class="grid grid-cols-3 gap-1.5">
				<div></div>
				<button ontouchstart={(e) => { e.preventDefault(); handleDirection('up'); }} class="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white active:bg-white/25">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
				</button>
				<div></div>
				<button ontouchstart={(e) => { e.preventDefault(); handleDirection('left'); }} class="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white active:bg-white/25">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
				</button>
				<div></div>
				<button ontouchstart={(e) => { e.preventDefault(); handleDirection('right'); }} class="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white active:bg-white/25">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
				</button>
				<div></div>
				<button ontouchstart={(e) => { e.preventDefault(); handleDirection('down'); }} class="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white active:bg-white/25">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
				</button>
				<div></div>
			</div>
		</div>
	{/if}
</div>
