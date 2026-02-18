const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);
const PAYLOAD_URL = process.env.PAYLOAD_URL || 'http://localhost:3000';
const HEARTBEAT_INTERVAL = 30_000;
const MAX_STROKES = 500;

interface ClientData {
	sender: string;
	alive: boolean;
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

type ServerWebSocket = import('bun').ServerWebSocket<ClientData>;

const clients = new Set<ServerWebSocket>();
const strokeHistory: Stroke[] = [];

function getOnlineUsers(): string[] {
	const users = new Set<string>();
	for (const ws of clients) {
		if (ws.data.sender) users.add(ws.data.sender);
	}
	return [...users];
}

function broadcast(data: object) {
	const payload = JSON.stringify(data);
	for (const ws of clients) {
		ws.send(payload);
	}
}

function broadcastOnlineUsers() {
	broadcast({ type: 'users_online', users: getOnlineUsers() });
}

const server = Bun.serve({
	port: WS_PORT,

	fetch(req, server) {
		const url = new URL(req.url);
		if (url.pathname === '/ws') {
			const upgraded = server.upgrade<ClientData>(req, {
				data: { sender: '', alive: true },
			});
			if (upgraded) return undefined;
			return new Response('WebSocket upgrade failed', { status: 400 });
		}
		return new Response('WebSocket server running');
	},

	websocket: {
		open(ws: ServerWebSocket) {
			clients.add(ws);
		},

		async message(ws: ServerWebSocket, raw: string | Buffer) {
			let msg: Record<string, any>;
			try {
				msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
			} catch {
				ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
				return;
			}

			if (msg.type === 'join') {
				const sender = (msg.sender || '').trim();
				if (!sender || sender.length > 50) {
					ws.send(JSON.stringify({ type: 'error', message: 'Invalid sender (max 50 chars)' }));
					return;
				}
				ws.data.sender = sender;
				console.log(`[ws] ${sender} joined`);
				broadcastOnlineUsers();
				// Send current drawing state to the newly joined client
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
					broadcast({ type: 'new_message', message: saved.doc });
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
				// Cap history to prevent unbounded memory growth
				if (strokeHistory.length > MAX_STROKES) {
					strokeHistory.splice(0, strokeHistory.length - MAX_STROKES);
				}
				// Broadcast to all other clients (sender already rendered locally)
				const payload = JSON.stringify({ type: 'draw_stroke', stroke });
				for (const client of clients) {
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
				for (const client of clients) {
					if (client !== ws) client.send(payload);
				}
				return;
			}

			if (msg.type === 'draw_clear') {
				if (!ws.data.sender) return;
				strokeHistory.length = 0;
				const payload = JSON.stringify({ type: 'draw_clear', sender: ws.data.sender });
				for (const client of clients) {
					if (client !== ws) client.send(payload);
				}
				return;
			}

			ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
		},

		close(ws: ServerWebSocket) {
			const sender = ws.data.sender;
			clients.delete(ws);
			if (sender) {
				console.log(`[ws] ${sender} disconnected`);
				broadcastOnlineUsers();
			}
		},

		perMessageDeflate: true,
		idleTimeout: 120,
	},
});

// Heartbeat: ping all clients every 30s, terminate unresponsive ones
setInterval(() => {
	for (const ws of clients) {
		if (!ws.data.alive) {
			console.log(`[ws] Terminating unresponsive client: ${ws.data.sender || 'unknown'}`);
			ws.close();
			clients.delete(ws);
			continue;
		}
		ws.data.alive = false;
		ws.ping();
	}
}, HEARTBEAT_INTERVAL);

console.log(`[ws] Bun WebSocket server listening on port ${server.port}`);
