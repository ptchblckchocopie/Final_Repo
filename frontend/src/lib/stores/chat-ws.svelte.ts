import type { PayloadMessage } from '$lib/types/payload';
import type { Stroke, StrokeProgress } from '$lib/types/drawing';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface DrawCallbacks {
	onStroke: (stroke: Stroke) => void;
	onStrokeProgress: (data: StrokeProgress) => void;
	onClear: () => void;
	onSync: (strokes: Stroke[]) => void;
}

let socket = $state<WebSocket | null>(null);
let connectionStatus = $state<ConnectionStatus>('disconnected');
let onlineUsers = $state<string[]>([]);

let currentUsername = '';
let onMessageCallback: ((msg: PayloadMessage) => void) | null = null;
let drawCallbacks: DrawCallbacks | null = null;
let strokeBuffer: Stroke[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
const MAX_BACKOFF = 15_000;

function getWsUrl(): string {
	if (typeof window === 'undefined') return '';
	// In dev, Vite proxies /ws to the WS server
	// In prod, use PUBLIC_WS_URL env var or default to same-host
	const envUrl = (import.meta.env as Record<string, string>).PUBLIC_WS_URL;
	if (envUrl) return envUrl;
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${proto}//${window.location.host}/ws`;
}

export function getConnectionStatus(): ConnectionStatus {
	return connectionStatus;
}

export function getOnlineUsers(): string[] {
	return onlineUsers;
}

export function connectChat(username: string, onMessage: (msg: PayloadMessage) => void) {
	currentUsername = username;
	onMessageCallback = onMessage;
	reconnectAttempt = 0;
	openSocket();
}

export function disconnectChat() {
	clearReconnectTimer();
	onMessageCallback = null;
	drawCallbacks = null;
	strokeBuffer = [];
	currentUsername = '';
	reconnectAttempt = 0;
	if (socket) {
		socket.close();
		socket = null;
	}
	connectionStatus = 'disconnected';
	onlineUsers = [];
}

export function sendChatMessage(content: string) {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify({ type: 'message', content }));
}

// --- Drawing functions ---

export function registerDrawCallbacks(callbacks: DrawCallbacks) {
	drawCallbacks = callbacks;
	// Flush any strokes that arrived while the board was closed
	if (strokeBuffer.length > 0) {
		callbacks.onSync(strokeBuffer);
	}
}

export function unregisterDrawCallbacks() {
	drawCallbacks = null;
}

export function sendDrawStroke(stroke: Omit<Stroke, 'sender'>) {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify({ type: 'draw_stroke', stroke }));
}

export function sendDrawStrokeProgress(data: Omit<StrokeProgress, 'sender'>) {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(
		JSON.stringify({
			type: 'draw_stroke_progress',
			strokeId: data.strokeId,
			points: data.points,
			color: data.color,
			width: data.width,
			tool: data.tool,
		})
	);
}

export function sendDrawClear() {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify({ type: 'draw_clear' }));
}

function openSocket() {
	clearReconnectTimer();
	const url = getWsUrl();
	if (!url) return;

	connectionStatus = 'connecting';

	const ws = new WebSocket(url);
	socket = ws;

	ws.addEventListener('open', () => {
		connectionStatus = 'connected';
		reconnectAttempt = 0;
		ws.send(JSON.stringify({ type: 'join', sender: currentUsername }));
	});

	ws.addEventListener('message', (event) => {
		let data: Record<string, any>;
		try {
			data = JSON.parse(event.data);
		} catch {
			return;
		}

		if (data.type === 'new_message' && data.message && onMessageCallback) {
			onMessageCallback(data.message as PayloadMessage);
		} else if (data.type === 'users_online' && data.users) {
			onlineUsers = data.users;
		} else if (data.type === 'draw_stroke') {
			const stroke = data.stroke as Stroke;
			strokeBuffer.push(stroke);
			if (drawCallbacks) drawCallbacks.onStroke(stroke);
		} else if (data.type === 'draw_stroke_progress') {
			if (drawCallbacks) drawCallbacks.onStrokeProgress(data as unknown as StrokeProgress);
		} else if (data.type === 'draw_clear') {
			strokeBuffer = [];
			if (drawCallbacks) drawCallbacks.onClear();
		} else if (data.type === 'draw_sync') {
			strokeBuffer = data.strokes as Stroke[];
			if (drawCallbacks) drawCallbacks.onSync(strokeBuffer);
		} else if (data.type === 'error') {
			console.warn('[chat-ws] Server error:', data.message || data);
		}
	});

	ws.addEventListener('close', () => {
		socket = null;
		connectionStatus = 'disconnected';
		onlineUsers = [];
		scheduleReconnect();
	});

	ws.addEventListener('error', () => {
		// The close event will fire after error, triggering reconnect
	});
}

function scheduleReconnect() {
	if (!currentUsername || !onMessageCallback) return;
	clearReconnectTimer();
	const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_BACKOFF);
	reconnectAttempt++;
	reconnectTimer = setTimeout(() => {
		openSocket();
	}, delay);
}

function clearReconnectTimer() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
}
