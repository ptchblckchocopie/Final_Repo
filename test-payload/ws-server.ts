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
	kind: 'chat' | 'game';
	sender: string;
	alive: boolean;
	gamePlayerId?: string;
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

// --- Server ---
const server = Bun.serve({
	port: WS_PORT,

	fetch(req, server) {
		const url = new URL(req.url);

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
}, HEARTBEAT_INTERVAL);

console.log(`[ws] Bun WebSocket server listening on port ${server.port}`);
