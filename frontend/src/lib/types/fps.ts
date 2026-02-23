export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

export interface FPSPlayerData {
	id: string;
	name: string;
	color: string;
	position: Vec3;
	rotation: { yaw: number; pitch: number };
	health: number;
	score: number;
	kills: number;
	alive: boolean;
}

export type EnemyType = 'grunt' | 'brute' | 'sprinter';

export interface FPSEnemyData {
	id: string;
	type: EnemyType;
	position: Vec3;
	health: number;
	maxHealth: number;
	alive: boolean;
}

export interface WaveInfo {
	number: number;
	totalEnemies: number;
	enemiesRemaining: number;
	state: 'countdown' | 'active' | 'completed';
	countdownSeconds: number;
}

export interface FPSGameState {
	tick: number;
	timestamp: number;
	players: FPSPlayerData[];
	enemies: FPSEnemyData[];
	wave: WaveInfo;
	gameOver: boolean;
	teamScore: number;
}

export interface ArenaConfig {
	width: number;
	depth: number;
	height: number;
}

export interface FPSCallbacks {
	onJoined: (data: { playerId: string; arena: ArenaConfig; tickRate: number }) => void;
	onState: (state: FPSGameState) => void;
	onHit: (data: { enemyId: string; damage: number; killed: boolean; playerId: string }) => void;
	onPlayerHit: (data: { playerId: string; damage: number; enemyId: string }) => void;
	onPlayerDied: (data: { playerId: string }) => void;
	onWaveStart: (wave: WaveInfo) => void;
	onWaveComplete: (wave: WaveInfo) => void;
	onGameOver: (data: {
		teamScore: number;
		playerScores: { id: string; name: string; score: number; kills: number }[];
	}) => void;
	onPlayerCount: (count: number) => void;
}
