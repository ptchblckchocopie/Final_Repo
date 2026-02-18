export interface Point {
	x: number;
	y: number;
}

export interface Stroke {
	id: string;
	sender: string;
	points: Point[];
	color: string;
	width: number;
	tool: 'pen' | 'eraser';
}

export interface StrokeProgress {
	strokeId: string;
	sender: string;
	points: Point[];
	color: string;
	width: number;
	tool: 'pen' | 'eraser';
}
