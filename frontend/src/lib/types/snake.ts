export interface SnakeSegment {
	x: number;
	y: number;
}

export type SnakePattern = 'solid' | 'striped' | 'neon' | 'rainbow' | 'dotted';
export type SnakeHat = 'none' | 'crown' | 'tophat' | 'party' | 'halo' | 'horns';
export type SnakeEyes = 'normal' | 'angry' | 'cute' | 'alien' | 'cyclops' | 'sleepy';

export interface SnakeCosmetics {
	pattern: SnakePattern;
	hat: SnakeHat;
	eyes: SnakeEyes;
}

export const DEFAULT_COSMETICS: SnakeCosmetics = {
	pattern: 'solid',
	hat: 'none',
	eyes: 'normal',
};

export const PATTERN_OPTIONS: { value: SnakePattern; label: string }[] = [
	{ value: 'solid', label: 'Solid' },
	{ value: 'striped', label: 'Striped' },
	{ value: 'neon', label: 'Neon' },
	{ value: 'rainbow', label: 'Rainbow' },
	{ value: 'dotted', label: 'Dotted' },
];

export const HAT_OPTIONS: { value: SnakeHat; label: string }[] = [
	{ value: 'none', label: 'None' },
	{ value: 'crown', label: 'Crown' },
	{ value: 'tophat', label: 'Top Hat' },
	{ value: 'party', label: 'Party' },
	{ value: 'halo', label: 'Halo' },
	{ value: 'horns', label: 'Horns' },
];

export const EYES_OPTIONS: { value: SnakeEyes; label: string }[] = [
	{ value: 'normal', label: 'Normal' },
	{ value: 'angry', label: 'Angry' },
	{ value: 'cute', label: 'Cute' },
	{ value: 'alien', label: 'Alien' },
	{ value: 'cyclops', label: 'Cyclops' },
	{ value: 'sleepy', label: 'Sleepy' },
];

export interface SnakeData {
	id: string;
	name: string;
	color: string;
	segments: SnakeSegment[];
	score: number;
	direction: 'up' | 'down' | 'left' | 'right';
	alive: boolean;
	cosmetics: SnakeCosmetics;
}

export interface FoodData {
	x: number;
	y: number;
	id: string;
}

export interface SnakeGameState {
	tick: number;
	timestamp: number;
	snakes: SnakeData[];
	food: FoodData[];
}
