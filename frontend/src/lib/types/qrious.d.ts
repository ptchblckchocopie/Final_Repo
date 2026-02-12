declare module 'qrious' {
	interface QRiousOptions {
		element?: HTMLCanvasElement;
		value?: string;
		size?: number;
		background?: string;
		foreground?: string;
		level?: 'L' | 'M' | 'Q' | 'H';
		padding?: number;
	}

	class QRious {
		constructor(options?: QRiousOptions);
		toDataURL(type?: string): string;
	}

	export default QRious;
}
