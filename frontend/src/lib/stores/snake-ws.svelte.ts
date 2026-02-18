import type { SnakeGameState, SnakeCosmetics } from '$lib/types/snake';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface SnakeCallbacks {
	onJoined: (data: { playerId: string; mapSize: number; tickRate: number }) => void;
	onState: (state: SnakeGameState) => void;
	onDied: (data: { playerId: string; killedBy: string | null }) => void;
	onRespawned: (data: { playerId: string }) => void;
	onPlayerCount: (count: number) => void;
}

let socket = $state<WebSocket | null>(null);
let connectionStatus = $state<ConnectionStatus>('disconnected');
let playerId = $state('');
let mapSize = $state(2000);
let playerCount = $state(0);

let ping = $state(0);

let callbacks: SnakeCallbacks | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let lastPingSent = 0;
let reconnectAttempt = 0;
let currentName = '';
let currentColor = '';
let currentCosmetics: SnakeCosmetics | null = null;
const MAX_BACKOFF = 15_000;
const PING_INTERVAL = 2000;

function getWsUrl(): string {
	if (typeof window === 'undefined') return '';
	const envUrl = (import.meta.env as Record<string, string>).PUBLIC_WS_URL;
	if (envUrl) return envUrl.replace(/\/ws$/, '/ws/snake');
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${proto}//${window.location.host}/ws/snake`;
}

export function getGameConnectionStatus(): ConnectionStatus {
	return connectionStatus;
}

export function getPlayerId(): string {
	return playerId;
}

export function getMapSize(): number {
	return mapSize;
}

export function getPlayerCount(): number {
	return playerCount;
}

export function getPing(): number {
	return ping;
}

export function connectGame(name: string, color: string, cosmetics: SnakeCosmetics, cbs: SnakeCallbacks) {
	currentName = name;
	currentColor = color;
	currentCosmetics = cosmetics;
	callbacks = cbs;
	reconnectAttempt = 0;
	openSocket();
}

export function disconnectGame() {
	clearReconnectTimer();
	if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'snake_leave' }));
	}
	callbacks = null;
	currentName = '';
	currentColor = '';
	currentCosmetics = null;
	reconnectAttempt = 0;
	if (socket) {
		socket.close();
		socket = null;
	}
	connectionStatus = 'disconnected';
	playerId = '';
	playerCount = 0;
	ping = 0;
}

export function sendDirection(direction: 'up' | 'down' | 'left' | 'right') {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify({ type: 'snake_direction', direction }));
}

export function sendRespawn() {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify({ type: 'snake_respawn' }));
}

function openSocket() {
	clearReconnectTimer();
	const url = getWsUrl();
	if (!url) return;

	// Close any existing socket to prevent orphaned connections
	if (socket) {
		try { socket.close(); } catch {}
		socket = null;
	}
	if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }

	connectionStatus = 'connecting';
	const ws = new WebSocket(url);
	socket = ws;

	ws.addEventListener('open', () => {
		connectionStatus = 'connected';
		reconnectAttempt = 0;
		ws.send(JSON.stringify({ type: 'snake_join', name: currentName, color: currentColor, cosmetics: currentCosmetics }));
		// Start ping loop
		if (pingInterval) clearInterval(pingInterval);
		pingInterval = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				lastPingSent = performance.now();
				ws.send(JSON.stringify({ type: 'snake_ping', t: lastPingSent }));
			}
		}, PING_INTERVAL);
	});

	ws.addEventListener('message', (event) => {
		let data: Record<string, any>;
		try {
			data = JSON.parse(event.data);
		} catch {
			return;
		}

		if (data.type === 'snake_joined' && callbacks) {
			playerId = data.playerId;
			mapSize = data.mapSize;
			callbacks.onJoined({
				playerId: data.playerId,
				mapSize: data.mapSize,
				tickRate: data.tickRate
			});
		} else if (data.type === 'snake_state' && callbacks) {
			callbacks.onState(data as unknown as SnakeGameState);
		} else if (data.type === 'snake_died' && callbacks) {
			callbacks.onDied({ playerId: data.playerId, killedBy: data.killedBy });
		} else if (data.type === 'snake_respawned' && callbacks) {
			callbacks.onRespawned({ playerId: data.playerId });
		} else if (data.type === 'snake_players' && callbacks) {
			playerCount = data.count;
			callbacks.onPlayerCount(data.count);
		} else if (data.type === 'snake_pong') {
			if (lastPingSent > 0) {
				ping = Math.round(performance.now() - lastPingSent);
			}
		} else if (data.type === 'error') {
			console.warn('[snake-ws] Server error:', data.message || data);
		}
	});

	ws.addEventListener('close', () => {
		socket = null;
		connectionStatus = 'disconnected';
		if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
		scheduleReconnect();
	});

	ws.addEventListener('error', () => {
		// close event will fire after, triggering reconnect
	});
}

function scheduleReconnect() {
	if (!currentName || !callbacks) return;
	clearReconnectTimer();
	const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_BACKOFF);
	reconnectAttempt++;
	reconnectTimer = setTimeout(() => openSocket(), delay);
}

function clearReconnectTimer() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
}
