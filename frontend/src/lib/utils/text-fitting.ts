import type { VAlign } from '$lib/types/ticket';

/**
 * Split text into lines that fit within maxWidth using the current canvas context font.
 */
export function getWrappedLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number
): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines.length > 0 ? lines : [''];
}

/**
 * Find the largest font size that fits text within the given bounds.
 * Uses binary search for efficiency.
 */
export function autoFitFontSize(
	text: string,
	maxWidth: number,
	maxHeight: number,
	fontFamily: string,
	isBold: boolean,
	noWrap: boolean,
	isItalic: boolean = false
): number {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d')!;

	let lo = 6;
	let hi = Math.min(300, Math.floor(maxHeight / 1.2));
	let best = lo;

	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const weight = isBold ? 'bold' : 'normal';
		const style = isItalic ? 'italic' : 'normal';
		ctx.font = `${style} ${weight} ${mid}px "${fontFamily}"`;

		let fits: boolean;
		if (noWrap) {
			const metrics = ctx.measureText(text);
			fits = metrics.width <= maxWidth && mid * 1.2 <= maxHeight;
		} else {
			const lines = getWrappedLines(ctx, text, maxWidth);
			const totalHeight = lines.length * mid * 1.2;
			fits = totalHeight <= maxHeight;
		}

		if (fits) {
			best = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	return best;
}

/**
 * Compute the Y offset for vertical text alignment within a box.
 */
export function computeVerticalY(
	boxY: number,
	boxH: number,
	contentHeight: number,
	_lineCount: number,
	vAlign: VAlign
): number {
	switch (vAlign) {
		case 'top':
			return boxY;
		case 'center':
			return boxY + (boxH - contentHeight) / 2;
		case 'bottom':
			return boxY + boxH - contentHeight;
		default:
			return boxY;
	}
}
