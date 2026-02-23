import type { FPSGameState, FPSCallbacks, ArenaConfig, Vec3 } from '$lib/types/fps';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

let socket = $state<WebSocket | null>(null);
let connectionStatus = $state<ConnectionStatus>('disconnected');
let playerId = $state('');
let playerCount = $state(0);
let ping = $state(0);

let callbacks: FPSCallbacks | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let lastPingSent = 0;
let reconnectAttempt = 0;
let currentName = '';
let currentColor = '';
const MAX_BACKOFF = 15_000;
const PING_INTERVAL = 2000;

// Throttle position updates to ~20Hz
let lastMoveSent = 0;
const MOVE_THROTTLE = 50;

function getWsUrl(): string {
	if (typeof window === 'undefined') return '';
	const envUrl = (import.meta.env as Record<string, string>).PUBLIC_WS_URL?.trim();
	if (envUrl) return envUrl.replace(/\/ws$/, '/ws/fps');
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${proto}//${window.location.host}/ws/fps`;
}

export function getFPSConnectionStatus(): ConnectionStatus {
	return connectionStatus;
}

export function getFPSPlayerId(): string {
	return playerId;
}

export function getFPSPlayerCount(): number {
	return playerCount;
}

export function getFPSPing(): number {
	return ping;
}

export function connectFPS(name: string, color: string, cbs: FPSCallbacks) {
	currentName = name;
	currentColor = color;
	callbacks = cbs;
	reconnectAttempt = 0;
	openSocket();
}

export function disconnectFPS() {
	clearReconnectTimer();
	if (pingInterval) {
		clearInterval(pingInterval);
		pingInterval = null;
	}
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'fps_leave' }));
	}
	callbacks = null;
	currentName = '';
	currentColor = '';
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

export function sendPlayerState(
	position: Vec3,
	rotation: { yaw: number; pitch: number },
) {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	const now = performance.now();
	if (now - lastMoveSent < MOVE_THROTTLE) return;
	lastMoveSent = now;
	socket.send(JSON.stringify({ type: 'fps_move', position, rotation }));
}

export function sendShoot(origin: Vec3, direction: Vec3) {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify({ type: 'fps_shoot', origin, direction }));
}

export function sendRespawn() {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify({ type: 'fps_respawn' }));
}

function openSocket() {
	clearReconnectTimer();
	const url = getWsUrl();
	if (!url) return;

	if (socket) {
		try {
			socket.close();
		} catch {}
		socket = null;
	}
	if (pingInterval) {
		clearInterval(pingInterval);
		pingInterval = null;
	}

	connectionStatus = 'connecting';
	const ws = new WebSocket(url);
	socket = ws;

	ws.addEventListener('open', () => {
		connectionStatus = 'connected';
		reconnectAttempt = 0;
		ws.send(JSON.stringify({ type: 'fps_join', name: currentName, color: currentColor }));
		if (pingInterval) clearInterval(pingInterval);
		pingInterval = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				lastPingSent = performance.now();
				ws.send(JSON.stringify({ type: 'fps_ping', t: lastPingSent }));
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

		if (data.type === 'fps_joined' && callbacks) {
			playerId = data.playerId;
			callbacks.onJoined({
				playerId: data.playerId,
				arena: data.arena as ArenaConfig,
				tickRate: data.tickRate,
			});
		} else if (data.type === 'fps_state' && callbacks) {
			callbacks.onState(data as unknown as FPSGameState);
		} else if (data.type === 'fps_hit' && callbacks) {
			callbacks.onHit({
				enemyId: data.enemyId,
				damage: data.damage,
				killed: data.killed,
				playerId: data.playerId,
			});
		} else if (data.type === 'fps_player_hit' && callbacks) {
			callbacks.onPlayerHit({
				playerId: data.playerId,
				damage: data.damage,
				enemyId: data.enemyId,
			});
		} else if (data.type === 'fps_player_died' && callbacks) {
			callbacks.onPlayerDied({ playerId: data.playerId });
		} else if (data.type === 'fps_wave_start' && callbacks) {
			callbacks.onWaveStart(data.wave);
		} else if (data.type === 'fps_wave_complete' && callbacks) {
			callbacks.onWaveComplete(data.wave);
		} else if (data.type === 'fps_game_over' && callbacks) {
			callbacks.onGameOver({
				teamScore: data.teamScore,
				playerScores: data.playerScores,
			});
		} else if (data.type === 'fps_players' && callbacks) {
			playerCount = data.count;
			callbacks.onPlayerCount(data.count);
		} else if (data.type === 'fps_pong') {
			if (lastPingSent > 0) {
				ping = Math.round(performance.now() - lastPingSent);
			}
		} else if (data.type === 'error') {
			console.warn('[fps-ws] Server error:', data.message || data);
		}
	});

	ws.addEventListener('close', () => {
		socket = null;
		connectionStatus = 'disconnected';
		if (pingInterval) {
			clearInterval(pingInterval);
			pingInterval = null;
		}
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
