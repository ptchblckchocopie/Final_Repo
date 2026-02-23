const WS_PORT = parseInt(process.env.PORT || process.env.WS_PORT || '3001', 10);
const PAYLOAD_URL = process.env.PAYLOAD_URL || 'http://localhost:3000';
const HEARTBEAT_INTERVAL = 30_000;
const MAX_STROKES = 500;

// --- Snake Game Constants ---
const TICK_RATE = 15;
const TICK_MS = Math.round(1000 / TICK_RATE);
const MAP_SIZE = 2000;
const GRID = 20;
const INITIAL_LENGTH = 5;
const FOOD_COUNT = 30;
const RESPAWN_DELAY = 3000;

interface ClientData {
	kind: 'chat' | 'game' | 'fps';
	sender: string;
	alive: boolean;
	gamePlayerId?: string;
	fpsPlayerId?: string;
}

interface Point {
	x: number;
	y: number;
}

interface Stroke {
	id: string;
	sender: string;
	points: Point[];
	color: string;
	width: number;
	tool: 'pen' | 'eraser';
}

// --- Snake Game Types ---
interface SnakeSegment {
	x: number;
	y: number;
}

interface SnakeCosmetics {
	pattern: string;
	hat: string;
	eyes: string;
}

const DEFAULT_COSMETICS: SnakeCosmetics = { pattern: 'solid', hat: 'none', eyes: 'normal' };

interface PlayerState {
	id: string;
	name: string;
	color: string;
	cosmetics: SnakeCosmetics;
	segments: SnakeSegment[];
	direction: 'up' | 'down' | 'left' | 'right';
	nextDirection: 'up' | 'down' | 'left' | 'right';
	score: number;
	alive: boolean;
	respawnAt: number | null;
}

interface FoodItem {
	id: string;
	x: number;
	y: number;
}

type ServerWebSocket = import('bun').ServerWebSocket<ClientData>;

// --- Chat State ---
const chatClients = new Set<ServerWebSocket>();
const strokeHistory: Stroke[] = [];

// --- Snake Game State ---
const gameClients = new Map<string, ServerWebSocket>();
const players = new Map<string, PlayerState>();
const foodItems: FoodItem[] = [];
let gameTickInterval: ReturnType<typeof setInterval> | null = null;
let gameTick = 0;
let nextFoodId = 0;

// --- FPS Game Constants ---
const FPS_TICK_RATE = 20;
const FPS_TICK_MS = Math.round(1000 / FPS_TICK_RATE);
const FPS_ARENA_WIDTH = 100;
const FPS_ARENA_DEPTH = 100;
const FPS_ARENA_HEIGHT = 4;
const FPS_PLAYER_HEALTH = 100;
const FPS_ENEMY_DAMAGE = 10;
const FPS_ENEMY_ATTACK_RANGE = 2.5;
const FPS_ENEMY_ATTACK_CD = 1000;
const FPS_BULLET_DAMAGE = 25;
const FPS_BULLET_RANGE = 100;
const FPS_WAVE_COUNTDOWN = 5;
const FPS_RESPAWN_DELAY = 3000;

const FPS_ENEMY_CONFIG = {
	grunt:    { speed: 3,   hp: 30,  hitRadius: 0.7, score: 10 },
	brute:    { speed: 1.5, hp: 100, hitRadius: 1.0, score: 30 },
	sprinter: { speed: 6,   hp: 15,  hitRadius: 0.5, score: 15 },
} as const;

type FPSEnemyType = 'grunt' | 'brute' | 'sprinter';

interface Vec3 { x: number; y: number; z: number; }

interface FPSPlayer {
	id: string;
	name: string;
	color: string;
	position: Vec3;
	rotation: { yaw: number; pitch: number };
	health: number;
	score: number;
	kills: number;
	alive: boolean;
	respawnAt: number | null;
}

interface FPSEnemy {
	id: string;
	type: FPSEnemyType;
	position: Vec3;
	health: number;
	maxHealth: number;
	alive: boolean;
	lastAttackTime: number;
}

// --- FPS Game State ---
const fpsClients = new Map<string, ServerWebSocket>();
const fpsPlayers = new Map<string, FPSPlayer>();
const fpsEnemies = new Map<string, FPSEnemy>();
let fpsTickInterval: ReturnType<typeof setInterval> | null = null;
let fpsGameTick = 0;
let fpsWaveNumber = 0;
let fpsWaveState: 'countdown' | 'active' | 'completed' = 'countdown';
let fpsWaveCountdown = FPS_WAVE_COUNTDOWN;
let fpsWaveEnemiesTotal = 0;
let fpsGameOver = false;
let fpsTeamScore = 0;
let fpsNextEnemyId = 0;
let fpsLastTickTime = Date.now();

// --- Chat helpers ---
function getOnlineUsers(): string[] {
	const users = new Set<string>();
	for (const ws of chatClients) {
		if (ws.data.sender) users.add(ws.data.sender);
	}
	return [...users];
}

function broadcastChat(data: object) {
	const payload = JSON.stringify(data);
	for (const ws of chatClients) {
		ws.send(payload);
	}
}

function broadcastOnlineUsers() {
	broadcastChat({ type: 'users_online', users: getOnlineUsers() });
}

// --- Snake Game helpers ---
function broadcastGame(data: object) {
	const payload = JSON.stringify(data);
	for (const ws of gameClients.values()) {
		ws.send(payload);
	}
}

function broadcastPlayerCount() {
	broadcastGame({ type: 'snake_players', count: gameClients.size });
}

function snapToGrid(v: number): number {
	return Math.round(v / GRID) * GRID;
}

function randomGridPos(): SnakeSegment {
	const margin = GRID * 3;
	const x = snapToGrid(margin + Math.random() * (MAP_SIZE - margin * 2));
	const y = snapToGrid(margin + Math.random() * (MAP_SIZE - margin * 2));
	return { x, y };
}

function spawnFood(): FoodItem {
	const pos = randomGridPos();
	return { id: `f${nextFoodId++}`, x: pos.x, y: pos.y };
}

function initFood() {
	foodItems.length = 0;
	for (let i = 0; i < FOOD_COUNT; i++) {
		foodItems.push(spawnFood());
	}
}

function spawnSnake(id: string, name: string, color: string, cosmetics: SnakeCosmetics): PlayerState {
	const head = randomGridPos();
	const segments: SnakeSegment[] = [head];
	for (let i = 1; i < INITIAL_LENGTH; i++) {
		segments.push({ x: head.x, y: head.y + i * GRID });
	}
	return {
		id,
		name,
		color,
		cosmetics,
		segments,
		direction: 'up',
		nextDirection: 'up',
		score: 0,
		alive: true,
		respawnAt: null,
	};
}

function isOpposite(a: string, b: string): boolean {
	return (
		(a === 'up' && b === 'down') ||
		(a === 'down' && b === 'up') ||
		(a === 'left' && b === 'right') ||
		(a === 'right' && b === 'left')
	);
}

function moveHead(head: SnakeSegment, dir: string): SnakeSegment {
	switch (dir) {
		case 'up':
			return { x: head.x, y: head.y - GRID };
		case 'down':
			return { x: head.x, y: head.y + GRID };
		case 'left':
			return { x: head.x - GRID, y: head.y };
		case 'right':
			return { x: head.x + GRID, y: head.y };
		default:
			return { ...head };
	}
}

function gameTicker() {
	const now = Date.now();
	gameTick++;

	// 0. Clean up stale players (orphaned connections)
	for (const [id, ws] of gameClients) {
		if (ws.readyState !== 1) { // 1 = OPEN
			gameClients.delete(id);
			players.delete(id);
		}
	}
	for (const id of players.keys()) {
		if (!gameClients.has(id)) {
			players.delete(id);
		}
	}
	if (gameClients.size === 0) {
		stopGameLoop();
		foodItems.length = 0;
		players.clear();
		return;
	}

	// 1. Apply direction changes (block 180-degree reversal)
	for (const player of players.values()) {
		if (!player.alive) continue;
		if (!isOpposite(player.direction, player.nextDirection)) {
			player.direction = player.nextDirection;
		}
	}

	// 2. Move snakes
	for (const player of players.values()) {
		if (!player.alive) continue;
		const newHead = moveHead(player.segments[0], player.direction);
		player.segments.unshift(newHead);
	}

	// 4. Food collision
	for (const player of players.values()) {
		if (!player.alive) continue;
		const head = player.segments[0];
		const foodIdx = foodItems.findIndex(
			(f) => Math.abs(f.x - head.x) < GRID && Math.abs(f.y - head.y) < GRID
		);
		if (foodIdx !== -1) {
			foodItems.splice(foodIdx, 1);
			player.score += 10;
			// Don't pop tail = snake grows
		} else {
			player.segments.pop();
		}
	}

	// 5. Wall collision
	for (const player of players.values()) {
		if (!player.alive) continue;
		const head = player.segments[0];
		if (head.x < 0 || head.x >= MAP_SIZE || head.y < 0 || head.y >= MAP_SIZE) {
			killPlayer(player, null);
		}
	}

	// 6. Snake-vs-snake body collision
	const alivePlayers = [...players.values()].filter((p) => p.alive);
	for (const player of alivePlayers) {
		const head = player.segments[0];
		for (const other of alivePlayers) {
			// Check collision with other snake's body (skip head of self)
			const startIdx = other.id === player.id ? 1 : 0;
			for (let i = startIdx; i < other.segments.length; i++) {
				const seg = other.segments[i];
				if (head.x === seg.x && head.y === seg.y) {
					killPlayer(player, other.id === player.id ? null : other.id);
					break;
				}
			}
			if (!player.alive) break;
		}
	}

	// 7. Replenish food
	while (foodItems.length < FOOD_COUNT) {
		foodItems.push(spawnFood());
	}

	// 8. Broadcast state
	const snakes = [...players.values()].map((p) => ({
		id: p.id,
		name: p.name,
		color: p.color,
		cosmetics: p.cosmetics,
		segments: p.segments,
		score: p.score,
		direction: p.direction,
		alive: p.alive,
	}));

	broadcastGame({
		type: 'snake_state',
		tick: gameTick,
		timestamp: now,
		snakes,
		food: foodItems,
	});
}

function respawnPlayer(player: PlayerState) {
	const head = randomGridPos();
	player.segments = [head];
	for (let i = 1; i < INITIAL_LENGTH; i++) {
		player.segments.push({ x: head.x, y: head.y + i * GRID });
	}
	player.direction = 'up';
	player.nextDirection = 'up';
	player.score = 0;
	player.alive = true;
	player.respawnAt = null;
	broadcastGame({ type: 'snake_respawned', playerId: player.id });
	broadcastPlayerCount();
}

function killPlayer(player: PlayerState, killedBy: string | null) {
	player.alive = false;
	player.respawnAt = null;

	// Drop food where the snake body was
	for (let i = 0; i < player.segments.length; i += 2) {
		if (foodItems.length < FOOD_COUNT + 20) {
			foodItems.push(spawnFood());
		}
	}

	broadcastGame({ type: 'snake_died', playerId: player.id, killedBy });
	broadcastPlayerCount();
}

function startGameLoop() {
	if (gameTickInterval) return;
	gameTick = 0;
	if (foodItems.length === 0) initFood();
	gameTickInterval = setInterval(gameTicker, TICK_MS);
	console.log('[snake] Game loop started');
}

function stopGameLoop() {
	if (gameTickInterval) {
		clearInterval(gameTickInterval);
		gameTickInterval = null;
		console.log('[snake] Game loop stopped');
	}
}

function generatePlayerId(): string {
	return 'p_' + Math.random().toString(36).slice(2, 10);
}

// --- FPS Game helpers ---
function broadcastFPS(data: object) {
	const payload = JSON.stringify(data);
	for (const ws of fpsClients.values()) {
		ws.send(payload);
	}
}

function broadcastFPSPlayerCount() {
	broadcastFPS({ type: 'fps_players', count: fpsClients.size });
}

function fpsRandomSpawnPos(): Vec3 {
	const halfW = FPS_ARENA_WIDTH / 2 - 3;
	const halfD = FPS_ARENA_DEPTH / 2 - 3;
	return {
		x: (Math.random() - 0.5) * 2 * halfW,
		y: 0,
		z: (Math.random() - 0.5) * 2 * halfD,
	};
}

function fpsSpawnEnemyAtEdge(): Vec3 {
	const halfW = FPS_ARENA_WIDTH / 2 - 1;
	const halfD = FPS_ARENA_DEPTH / 2 - 1;
	const side = Math.floor(Math.random() * 4);
	switch (side) {
		case 0: return { x: -halfW, y: 0, z: (Math.random() - 0.5) * 2 * halfD };
		case 1: return { x: halfW,  y: 0, z: (Math.random() - 0.5) * 2 * halfD };
		case 2: return { x: (Math.random() - 0.5) * 2 * halfW, y: 0, z: -halfD };
		default: return { x: (Math.random() - 0.5) * 2 * halfW, y: 0, z: halfD };
	}
}

function fpsGetWaveConfig(waveNum: number) {
	const totalEnemies = 3 + waveNum * 2;
	const gruntCount = Math.max(1, Math.round(totalEnemies * Math.max(0.3, 1 - waveNum * 0.05)));
	const bruteCount = Math.round(totalEnemies * Math.min(0.3, waveNum * 0.03));
	const sprinterCount = totalEnemies - gruntCount - bruteCount;
	return { totalEnemies, gruntCount, bruteCount, sprinterCount };
}

function fpsSpawnWaveEnemies() {
	const config = fpsGetWaveConfig(fpsWaveNumber);
	fpsWaveEnemiesTotal = config.totalEnemies;
	const types: FPSEnemyType[] = [];
	for (let i = 0; i < config.gruntCount; i++) types.push('grunt');
	for (let i = 0; i < config.bruteCount; i++) types.push('brute');
	for (let i = 0; i < config.sprinterCount; i++) types.push('sprinter');

	for (const type of types) {
		const cfg = FPS_ENEMY_CONFIG[type];
		const pos = fpsSpawnEnemyAtEdge();
		const id = `e${fpsNextEnemyId++}`;
		fpsEnemies.set(id, {
			id,
			type,
			position: pos,
			health: cfg.hp,
			maxHealth: cfg.hp,
			alive: true,
			lastAttackTime: 0,
		});
	}
}

function fpsRaySphereIntersect(
	origin: Vec3, dir: Vec3, center: Vec3, radius: number
): number | null {
	const ox = origin.x - center.x;
	const oy = origin.y - center.y;
	const oz = origin.z - center.z;
	const a = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z;
	const b = 2 * (ox * dir.x + oy * dir.y + oz * dir.z);
	const c = ox * ox + oy * oy + oz * oz - radius * radius;
	const disc = b * b - 4 * a * c;
	if (disc < 0) return null;
	const t = (-b - Math.sqrt(disc)) / (2 * a);
	return t >= 0 ? t : null;
}

function fpsHandleShoot(player: FPSPlayer, origin: Vec3, direction: Vec3) {
	if (!player.alive) return;
	const len = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
	if (len === 0) return;
	const dir = { x: direction.x / len, y: direction.y / len, z: direction.z / len };

	let closestHit: { enemy: FPSEnemy; dist: number } | null = null;

	for (const enemy of fpsEnemies.values()) {
		if (!enemy.alive) continue;
		const cfg = FPS_ENEMY_CONFIG[enemy.type];
		// Enemy center is at position + half height
		const center = { x: enemy.position.x, y: enemy.position.y + cfg.hitRadius, z: enemy.position.z };
		const dist = fpsRaySphereIntersect(origin, dir, center, cfg.hitRadius);
		if (dist !== null && dist <= FPS_BULLET_RANGE) {
			if (!closestHit || dist < closestHit.dist) {
				closestHit = { enemy, dist };
			}
		}
	}

	if (closestHit) {
		const enemy = closestHit.enemy;
		enemy.health -= FPS_BULLET_DAMAGE;
		const killed = enemy.health <= 0;
		if (killed) {
			enemy.alive = false;
			player.kills++;
			const cfg = FPS_ENEMY_CONFIG[enemy.type];
			player.score += cfg.score;
			fpsTeamScore += cfg.score;
		}
		broadcastFPS({
			type: 'fps_hit',
			enemyId: enemy.id,
			damage: FPS_BULLET_DAMAGE,
			killed,
			playerId: player.id,
		});
	}
}

function fpsTicker() {
	const now = Date.now();
	const delta = (now - fpsLastTickTime) / 1000;
	fpsLastTickTime = now;
	fpsGameTick++;

	// Clean up stale clients
	for (const [id, ws] of fpsClients) {
		if (ws.readyState !== 1) {
			fpsClients.delete(id);
			fpsPlayers.delete(id);
		}
	}
	for (const id of fpsPlayers.keys()) {
		if (!fpsClients.has(id)) fpsPlayers.delete(id);
	}
	if (fpsClients.size === 0) {
		fpsStopGameLoop();
		return;
	}

	// Handle respawns
	for (const player of fpsPlayers.values()) {
		if (!player.alive && player.respawnAt && now >= player.respawnAt) {
			player.alive = true;
			player.health = FPS_PLAYER_HEALTH;
			player.respawnAt = null;
			const pos = fpsRandomSpawnPos();
			player.position = { x: pos.x, y: 1.7, z: pos.z };
			broadcastFPS({ type: 'fps_player_respawned', playerId: player.id });
		}
	}

	// Wave state machine
	if (fpsWaveState === 'countdown') {
		fpsWaveCountdown -= delta;
		if (fpsWaveCountdown <= 0) {
			fpsWaveNumber++;
			fpsWaveState = 'active';
			fpsSpawnWaveEnemies();
			broadcastFPS({
				type: 'fps_wave_start',
				wave: {
					number: fpsWaveNumber,
					totalEnemies: fpsWaveEnemiesTotal,
					enemiesRemaining: fpsWaveEnemiesTotal,
					state: 'active',
					countdownSeconds: 0,
				},
			});
		}
	} else if (fpsWaveState === 'active') {
		// Move enemies toward nearest alive player
		const alivePlayers = [...fpsPlayers.values()].filter((p) => p.alive);

		for (const enemy of fpsEnemies.values()) {
			if (!enemy.alive) continue;

			if (alivePlayers.length === 0) continue;

			// Find closest player
			let closest: FPSPlayer | null = null;
			let closestDist = Infinity;
			for (const p of alivePlayers) {
				const dx = p.position.x - enemy.position.x;
				const dz = p.position.z - enemy.position.z;
				const dist = Math.sqrt(dx * dx + dz * dz);
				if (dist < closestDist) {
					closestDist = dist;
					closest = p;
				}
			}

			if (!closest) continue;

			if (closestDist <= FPS_ENEMY_ATTACK_RANGE) {
				// Attack
				if (now - enemy.lastAttackTime >= FPS_ENEMY_ATTACK_CD) {
					enemy.lastAttackTime = now;
					closest.health -= FPS_ENEMY_DAMAGE;
					broadcastFPS({
						type: 'fps_player_hit',
						playerId: closest.id,
						damage: FPS_ENEMY_DAMAGE,
						enemyId: enemy.id,
					});
					if (closest.health <= 0) {
						closest.health = 0;
						closest.alive = false;
						closest.respawnAt = now + FPS_RESPAWN_DELAY;
						broadcastFPS({ type: 'fps_player_died', playerId: closest.id });
					}
				}
			} else {
				// Move toward player
				const speed = FPS_ENEMY_CONFIG[enemy.type].speed;
				const dx = closest.position.x - enemy.position.x;
				const dz = closest.position.z - enemy.position.z;
				const dist = Math.sqrt(dx * dx + dz * dz);
				if (dist > 0) {
					enemy.position.x += (dx / dist) * speed * delta;
					enemy.position.z += (dz / dist) * speed * delta;
				}
			}
		}

		// Check if all enemies dead
		const aliveEnemies = [...fpsEnemies.values()].filter((e) => e.alive);
		if (aliveEnemies.length === 0) {
			fpsWaveState = 'completed';
			broadcastFPS({
				type: 'fps_wave_complete',
				wave: {
					number: fpsWaveNumber,
					totalEnemies: fpsWaveEnemiesTotal,
					enemiesRemaining: 0,
					state: 'completed',
					countdownSeconds: 0,
				},
			});
			// Prepare for next wave
			fpsEnemies.clear();
			fpsWaveState = 'countdown';
			fpsWaveCountdown = FPS_WAVE_COUNTDOWN;
		}

		// Check game over: all players dead at once
		const anyAlive = [...fpsPlayers.values()].some((p) => p.alive);
		if (!anyAlive && fpsPlayers.size > 0) {
			fpsGameOver = true;
			const playerScores = [...fpsPlayers.values()].map((p) => ({
				id: p.id,
				name: p.name,
				score: p.score,
				kills: p.kills,
			}));
			broadcastFPS({
				type: 'fps_game_over',
				teamScore: fpsTeamScore,
				playerScores,
			});
		}
	}

	// Broadcast state
	const playersArr = [...fpsPlayers.values()].map((p) => ({
		id: p.id,
		name: p.name,
		color: p.color,
		position: p.position,
		rotation: p.rotation,
		health: p.health,
		score: p.score,
		kills: p.kills,
		alive: p.alive,
	}));
	const enemiesArr = [...fpsEnemies.values()].map((e) => ({
		id: e.id,
		type: e.type,
		position: e.position,
		health: e.health,
		maxHealth: e.maxHealth,
		alive: e.alive,
	}));
	const aliveEnemyCount = enemiesArr.filter((e) => e.alive).length;

	broadcastFPS({
		type: 'fps_state',
		tick: fpsGameTick,
		timestamp: now,
		players: playersArr,
		enemies: enemiesArr,
		wave: {
			number: fpsWaveNumber,
			totalEnemies: fpsWaveEnemiesTotal,
			enemiesRemaining: aliveEnemyCount,
			state: fpsWaveState,
			countdownSeconds: Math.max(0, Math.ceil(fpsWaveCountdown)),
		},
		gameOver: fpsGameOver,
		teamScore: fpsTeamScore,
	});
}

function fpsStartGameLoop() {
	if (fpsTickInterval) return;
	fpsGameTick = 0;
	fpsWaveNumber = 0;
	fpsWaveState = 'countdown';
	fpsWaveCountdown = FPS_WAVE_COUNTDOWN;
	fpsWaveEnemiesTotal = 0;
	fpsGameOver = false;
	fpsTeamScore = 0;
	fpsEnemies.clear();
	fpsLastTickTime = Date.now();
	fpsTickInterval = setInterval(fpsTicker, FPS_TICK_MS);
	console.log('[fps] Game loop started');
}

function fpsStopGameLoop() {
	if (fpsTickInterval) {
		clearInterval(fpsTickInterval);
		fpsTickInterval = null;
		console.log('[fps] Game loop stopped');
	}
	fpsPlayers.clear();
	fpsEnemies.clear();
	fpsGameOver = false;
}

function fpsResetForPlayer() {
	// If game was over and a player respawns/joins, restart waves
	if (fpsGameOver) {
		fpsGameOver = false;
		fpsWaveNumber = 0;
		fpsWaveState = 'countdown';
		fpsWaveCountdown = FPS_WAVE_COUNTDOWN;
		fpsWaveEnemiesTotal = 0;
		fpsTeamScore = 0;
		fpsEnemies.clear();
		for (const p of fpsPlayers.values()) {
			p.score = 0;
			p.kills = 0;
		}
	}
}

function handleFPSDisconnect(ws: ServerWebSocket) {
	const pid = ws.data.fpsPlayerId;
	if (pid) {
		const player = fpsPlayers.get(pid);
		if (player) {
			console.log(`[fps] ${player.name} (${pid}) left`);
		}
		fpsClients.delete(pid);
		fpsPlayers.delete(pid);
		broadcastFPSPlayerCount();

		if (fpsClients.size === 0) {
			fpsStopGameLoop();
		}
	}
}

// --- Server ---
const server = Bun.serve({
	port: WS_PORT,

	fetch(req, server) {
		const url = new URL(req.url);

		if (url.pathname === '/ws/fps') {
			const upgraded = server.upgrade<ClientData>(req, {
				data: { kind: 'fps', sender: '', alive: true },
			});
			if (upgraded) return undefined;
			return new Response('WebSocket upgrade failed', { status: 400 });
		}

		if (url.pathname === '/ws/snake') {
			const upgraded = server.upgrade<ClientData>(req, {
				data: { kind: 'game', sender: '', alive: true },
			});
			if (upgraded) return undefined;
			return new Response('WebSocket upgrade failed', { status: 400 });
		}

		if (url.pathname === '/ws') {
			const upgraded = server.upgrade<ClientData>(req, {
				data: { kind: 'chat', sender: '', alive: true },
			});
			if (upgraded) return undefined;
			return new Response('WebSocket upgrade failed', { status: 400 });
		}

		return new Response('WebSocket server running');
	},

	websocket: {
		open(ws: ServerWebSocket) {
			if (ws.data.kind === 'chat') {
				chatClients.add(ws);
			}
			// Game clients are added on snake_join
		},

		async message(ws: ServerWebSocket, raw: string | Buffer) {
			let msg: Record<string, any>;
			try {
				msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
			} catch {
				ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
				return;
			}

			// --- Snake Game Messages ---
			if (ws.data.kind === 'game') {
				if (msg.type === 'snake_join') {
					// Clean up previous player for this WebSocket (reconnect case)
					const oldId = ws.data.gamePlayerId;
					if (oldId) {
						gameClients.delete(oldId);
						players.delete(oldId);
					}

					const name = (msg.name || '').trim().slice(0, 20) || 'Player';
					const color = (msg.color || '#22c55e').trim();
					const playerId = generatePlayerId();
					ws.data.gamePlayerId = playerId;
					gameClients.set(playerId, ws);

					const cosmetics: SnakeCosmetics = {
						pattern: msg.cosmetics?.pattern || 'solid',
						hat: msg.cosmetics?.hat || 'none',
						eyes: msg.cosmetics?.eyes || 'normal',
					};
					const player = spawnSnake(playerId, name, color, cosmetics);
					players.set(playerId, player);

					ws.send(
						JSON.stringify({
							type: 'snake_joined',
							playerId,
							mapSize: MAP_SIZE,
							tickRate: TICK_RATE,
						})
					);

					startGameLoop();
					broadcastPlayerCount();
					console.log(`[snake] ${name} (${playerId}) joined`);
					return;
				}

				if (msg.type === 'snake_direction') {
					const playerId = ws.data.gamePlayerId;
					if (!playerId) return;
					const player = players.get(playerId);
					if (!player || !player.alive) return;
					const dir = msg.direction;
					if (['up', 'down', 'left', 'right'].includes(dir)) {
						player.nextDirection = dir;
					}
					return;
				}

				if (msg.type === 'snake_respawn') {
					const pid = ws.data.gamePlayerId;
					if (!pid) return;
					const player = players.get(pid);
					if (player && !player.alive) {
						respawnPlayer(player);
					}
					return;
				}

				if (msg.type === 'snake_ping') {
					ws.send(JSON.stringify({ type: 'snake_pong', t: msg.t }));
					return;
				}

				if (msg.type === 'snake_leave') {
					handleGameDisconnect(ws);
					return;
				}

				ws.send(JSON.stringify({ type: 'error', message: `Unknown game message: ${msg.type}` }));
				return;
			}

			// --- FPS Game Messages ---
			if (ws.data.kind === 'fps') {
				if (msg.type === 'fps_join') {
					const oldId = ws.data.fpsPlayerId;
					if (oldId) {
						fpsClients.delete(oldId);
						fpsPlayers.delete(oldId);
					}

					const name = (msg.name || '').trim().slice(0, 20) || 'Soldier';
					const color = (msg.color || '#22c55e').trim();
					const pid = generatePlayerId();
					ws.data.fpsPlayerId = pid;
					fpsClients.set(pid, ws);

					const spawnPos = fpsRandomSpawnPos();
					fpsPlayers.set(pid, {
						id: pid,
						name,
						color,
						position: { x: spawnPos.x, y: 1.7, z: spawnPos.z },
						rotation: { yaw: 0, pitch: 0 },
						health: FPS_PLAYER_HEALTH,
						score: 0,
						kills: 0,
						alive: true,
						respawnAt: null,
					});

					ws.send(JSON.stringify({
						type: 'fps_joined',
						playerId: pid,
						arena: { width: FPS_ARENA_WIDTH, depth: FPS_ARENA_DEPTH, height: FPS_ARENA_HEIGHT },
						tickRate: FPS_TICK_RATE,
					}));

					fpsResetForPlayer();
					fpsStartGameLoop();
					broadcastFPSPlayerCount();
					console.log(`[fps] ${name} (${pid}) joined`);
					return;
				}

				if (msg.type === 'fps_move') {
					const pid = ws.data.fpsPlayerId;
					if (!pid) return;
					const player = fpsPlayers.get(pid);
					if (!player || !player.alive) return;
					if (msg.position) {
						player.position = {
							x: Math.max(-FPS_ARENA_WIDTH / 2, Math.min(FPS_ARENA_WIDTH / 2, msg.position.x || 0)),
							y: msg.position.y || 1.7,
							z: Math.max(-FPS_ARENA_DEPTH / 2, Math.min(FPS_ARENA_DEPTH / 2, msg.position.z || 0)),
						};
					}
					if (msg.rotation) {
						player.rotation = { yaw: msg.rotation.yaw || 0, pitch: msg.rotation.pitch || 0 };
					}
					return;
				}

				if (msg.type === 'fps_shoot') {
					const pid = ws.data.fpsPlayerId;
					if (!pid) return;
					const player = fpsPlayers.get(pid);
					if (!player) return;
					fpsHandleShoot(player, msg.origin, msg.direction);
					return;
				}

				if (msg.type === 'fps_respawn') {
					const pid = ws.data.fpsPlayerId;
					if (!pid) return;
					const player = fpsPlayers.get(pid);
					if (player && !player.alive) {
						player.alive = true;
						player.health = FPS_PLAYER_HEALTH;
						player.respawnAt = null;
						const pos = fpsRandomSpawnPos();
						player.position = { x: pos.x, y: 1.7, z: pos.z };
						broadcastFPS({ type: 'fps_player_respawned', playerId: player.id });
					}
					fpsResetForPlayer();
					return;
				}

				if (msg.type === 'fps_ping') {
					ws.send(JSON.stringify({ type: 'fps_pong', t: msg.t }));
					return;
				}

				if (msg.type === 'fps_leave') {
					handleFPSDisconnect(ws);
					return;
				}

				ws.send(JSON.stringify({ type: 'error', message: `Unknown FPS message: ${msg.type}` }));
				return;
			}

			// --- Chat Messages (existing) ---
			if (msg.type === 'join') {
				const sender = (msg.sender || '').trim();
				if (!sender || sender.length > 50) {
					ws.send(JSON.stringify({ type: 'error', message: 'Invalid sender (max 50 chars)' }));
					return;
				}
				ws.data.sender = sender;
				console.log(`[ws] ${sender} joined`);
				broadcastOnlineUsers();
				if (strokeHistory.length > 0) {
					ws.send(JSON.stringify({ type: 'draw_sync', strokes: strokeHistory }));
				}
				return;
			}

			if (msg.type === 'message') {
				if (!ws.data.sender) {
					ws.send(JSON.stringify({ type: 'error', message: 'Must join first' }));
					return;
				}
				const content = (msg.content || '').trim();
				if (!content || content.length > 1000) {
					ws.send(JSON.stringify({ type: 'error', message: 'Invalid content (1-1000 chars)' }));
					return;
				}

				try {
					const res = await fetch(`${PAYLOAD_URL}/api/messages`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ sender: ws.data.sender, content }),
					});

					if (!res.ok) {
						const errText = await res.text().catch(() => '');
						console.error(`[ws] Payload POST failed (${res.status}):`, errText);
						ws.send(JSON.stringify({ type: 'error', message: 'Failed to save message' }));
						return;
					}

					const saved = (await res.json()) as { doc: unknown };
					broadcastChat({ type: 'new_message', message: saved.doc });
				} catch (err) {
					console.error('[ws] Payload POST error:', err);
					ws.send(JSON.stringify({ type: 'error', message: 'Failed to save message' }));
				}
				return;
			}

			// --- Drawing message handlers ---

			if (msg.type === 'draw_stroke') {
				if (!ws.data.sender) return;
				const stroke: Stroke = {
					id: msg.stroke?.id,
					sender: ws.data.sender,
					points: msg.stroke?.points || [],
					color: msg.stroke?.color || '#000000',
					width: msg.stroke?.width || 3,
					tool: msg.stroke?.tool === 'eraser' ? 'eraser' : 'pen',
				};
				strokeHistory.push(stroke);
				if (strokeHistory.length > MAX_STROKES) {
					strokeHistory.splice(0, strokeHistory.length - MAX_STROKES);
				}
				const payload = JSON.stringify({ type: 'draw_stroke', stroke });
				for (const client of chatClients) {
					if (client !== ws) client.send(payload);
				}
				return;
			}

			if (msg.type === 'draw_stroke_progress') {
				if (!ws.data.sender) return;
				const payload = JSON.stringify({
					type: 'draw_stroke_progress',
					strokeId: msg.strokeId,
					sender: ws.data.sender,
					points: msg.points || [],
					color: msg.color || '#000000',
					width: msg.width || 3,
					tool: msg.tool === 'eraser' ? 'eraser' : 'pen',
				});
				for (const client of chatClients) {
					if (client !== ws) client.send(payload);
				}
				return;
			}

			if (msg.type === 'draw_clear') {
				if (!ws.data.sender) return;
				strokeHistory.length = 0;
				const payload = JSON.stringify({ type: 'draw_clear', sender: ws.data.sender });
				for (const client of chatClients) {
					if (client !== ws) client.send(payload);
				}
				return;
			}

			ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
		},

		pong(ws: ServerWebSocket) {
			ws.data.alive = true;
		},

		close(ws: ServerWebSocket) {
			if (ws.data.kind === 'game') {
				handleGameDisconnect(ws);
			} else if (ws.data.kind === 'fps') {
				handleFPSDisconnect(ws);
			} else {
				const sender = ws.data.sender;
				chatClients.delete(ws);
				if (sender) {
					console.log(`[ws] ${sender} disconnected`);
					broadcastOnlineUsers();
				}
			}
		},

		perMessageDeflate: true,
		idleTimeout: 120,
	},
});

function handleGameDisconnect(ws: ServerWebSocket) {
	const playerId = ws.data.gamePlayerId;
	if (playerId) {
		const player = players.get(playerId);
		if (player) {
			console.log(`[snake] ${player.name} (${playerId}) left`);
		}
		gameClients.delete(playerId);
		players.delete(playerId);
		broadcastPlayerCount();

		if (gameClients.size === 0) {
			stopGameLoop();
			foodItems.length = 0;
			players.clear();
		}
	}
}

// Heartbeat: ping all clients every 30s, terminate unresponsive ones
setInterval(() => {
	// Chat clients
	for (const ws of chatClients) {
		if (!ws.data.alive) {
			console.log(`[ws] Terminating unresponsive client: ${ws.data.sender || 'unknown'}`);
			ws.close();
			chatClients.delete(ws);
			continue;
		}
		ws.data.alive = false;
		ws.ping();
	}
	// Game clients
	for (const [id, ws] of gameClients) {
		if (!ws.data.alive) {
			console.log(`[snake] Terminating unresponsive game client: ${id}`);
			ws.close();
			handleGameDisconnect(ws);
			continue;
		}
		ws.data.alive = false;
		ws.ping();
	}
	// FPS clients
	for (const [id, ws] of fpsClients) {
		if (!ws.data.alive) {
			console.log(`[fps] Terminating unresponsive FPS client: ${id}`);
			ws.close();
			handleFPSDisconnect(ws);
			continue;
		}
		ws.data.alive = false;
		ws.ping();
	}
}, HEARTBEAT_INTERVAL);

console.log(`[ws] Bun WebSocket server listening on port ${server.port}`);
