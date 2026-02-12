export type ElementType = 'text' | 'qr';
export type CodeType = 'qr' | 'barcode';
export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'ITF14';
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'center' | 'bottom';
export type BackgroundFitMode = 'cover' | 'contain' | 'stretch' | 'original';
export type TicketType = 'ticket' | 'convention-id' | 'certificate' | 'others';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface TextStyles {
	fontSize: number;
	color: string;
	fontFamily: string;
	fontBold: boolean;
	fontItalic: boolean;
	fontUnderline: boolean;
	backgroundColor: string;
	opacity: number;
	horizontalAlign: HAlign;
	verticalAlign: VAlign;
}

export interface CodeSettings {
	codeType: CodeType;
	background: string;
	foreground: string;
	barcodeType?: BarcodeFormat;
	customLogo?: string;
}

export interface BaseElement {
	id: string;
	type: ElementType;
	position: Position;
	size: Size;
	rotation: number;
}

export interface TextElement extends BaseElement {
	type: 'text';
	textFormat: string;
	styles: TextStyles;
	allowOverflow: boolean;
	containInBox: boolean;
	disableNewLine: boolean;
}

export interface QrElement extends BaseElement {
	type: 'qr';
	placeholder: string;
	codeSettings: CodeSettings;
}

export type TicketElement = TextElement | QrElement;

export interface TicketSettings {
	type: TicketType;
	width: number;
	height: number;
	fitMode: BackgroundFitMode;
}

export interface LabelConfig {
	labelColumn: string;
	labelColors: Record<string, string>;
	labelBlockWidth: number;
	rightBlockEnabled: boolean;
	rightBlockWidth: number;
}

export interface LabelBlockRenderData {
	left: number;
	width: number;
	color: string;
	value: string;
	rightEnabled: boolean;
	rightWidth: number;
}

export interface TicketTemplate {
	id: string;
	name: string;
	builtIn: boolean;
	backgroundImage: string | null;
	ticketSettings: TicketSettings;
	elements: TicketElement[];
	labelBlock: { width: number } | null;
}

export interface ProjectData {
	version: string;
	timestamp: string;
	csvData: Record<string, string>[];
	csvHeaders: string[];
	backgroundImage: string | null;
	ticketSettings: TicketSettings;
	printSettings: { ticketGap: number };
	labelSettings: LabelConfig;
	elements: TicketElement[];
}

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message: string;
	duration: number;
}

export interface LayoutResult {
	ticketsPerRow: number;
	ticketsPerCol: number;
	ticketsPerPage: number;
	totalPages: number;
	orientation: 'portrait' | 'landscape';
	availableWidth: number;
	availableHeight: number;
}

export const TICKET_PRESETS: Record<TicketType, Size> = {
	ticket: { width: 226.32258, height: 80 },
	'convention-id': { width: 101.6, height: 152.4 },
	certificate: { width: 297, height: 210 },
	others: { width: 150, height: 100 }
};

export const SCALE_FACTOR = 4;

export function createDefaultTextElement(overrides?: Partial<TextElement>): TextElement {
	return {
		id: crypto.randomUUID(),
		type: 'text',
		position: { x: 10, y: 10 },
		size: { width: 150, height: 30 },
		rotation: 0,
		textFormat: '{Text}',
		styles: {
			fontSize: 16,
			color: '#000000',
			fontFamily: 'Arial',
			fontBold: false,
			fontItalic: false,
			fontUnderline: false,
			backgroundColor: '',
			opacity: 1,
			horizontalAlign: 'left',
			verticalAlign: 'top'
		},
		allowOverflow: false,
		containInBox: true,
		disableNewLine: false,
		...overrides
	};
}

export function createDefaultQrElement(overrides?: Partial<QrElement>): QrElement {
	return {
		id: crypto.randomUUID(),
		type: 'qr',
		position: { x: 10, y: 10 },
		size: { width: 80, height: 80 },
		rotation: 0,
		placeholder: '',
		codeSettings: {
			codeType: 'qr',
			background: '#ffffff',
			foreground: '#000000'
		},
		...overrides
	};
}
