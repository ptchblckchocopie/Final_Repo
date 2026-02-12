import type { TicketElement, TextElement, QrElement, BackgroundFitMode, LabelConfig } from '$lib/types/ticket';
import { formatTextWithData } from './format';
import { autoFitFontSize, getWrappedLines, computeVerticalY } from './text-fitting';
import { generateQR, addLogoToQR } from './qr-generator';
import { generateBarcode } from './barcode-generator';
import { getLabelBlockRenderData } from './label-block';

/**
 * Draw a background image on a canvas respecting the fit mode.
 */
export function drawBackgroundOnCanvas(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	canvasWidth: number,
	canvasHeight: number,
	fitMode: BackgroundFitMode
): void {
	switch (fitMode) {
		case 'cover': {
			const scale = Math.max(canvasWidth / img.width, canvasHeight / img.height);
			const w = img.width * scale;
			const h = img.height * scale;
			ctx.drawImage(img, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
			break;
		}
		case 'contain': {
			const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
			const w = img.width * scale;
			const h = img.height * scale;
			ctx.drawImage(img, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
			break;
		}
		case 'stretch':
			ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
			break;
		case 'original':
			ctx.drawImage(img, 0, 0);
			break;
	}
}

/**
 * Draw a text element on a canvas at the specified quality multiplier.
 */
function drawTextOnCanvas(
	ctx: CanvasRenderingContext2D,
	element: TextElement,
	rowData: Record<string, string>,
	quality: number
): void {
	const text = formatTextWithData(element.textFormat, rowData);
	const x = element.position.x * quality;
	const y = element.position.y * quality;
	const w = element.size.width * quality;
	const h = element.size.height * quality;

	ctx.save();

	// Apply opacity
	const opacity = element.styles.opacity ?? 1;
	if (opacity < 1) {
		ctx.globalAlpha = opacity;
	}

	if (element.rotation !== 0) {
		const cx = x + w / 2;
		const cy = y + h / 2;
		ctx.translate(cx, cy);
		ctx.rotate((element.rotation * Math.PI) / 180);
		ctx.translate(-cx, -cy);
	}

	// Draw background color
	if (element.styles.backgroundColor) {
		ctx.fillStyle = element.styles.backgroundColor;
		ctx.fillRect(x, y, w, h);
	}

	let fontSize = element.styles.fontSize * quality;
	if (element.containInBox) {
		fontSize = autoFitFontSize(text, w, h, element.styles.fontFamily, element.styles.fontBold, element.disableNewLine, element.styles.fontItalic) * quality;
	}

	const weight = element.styles.fontBold ? 'bold' : 'normal';
	const style = element.styles.fontItalic ? 'italic' : 'normal';
	ctx.font = `${style} ${weight} ${fontSize}px "${element.styles.fontFamily}"`;
	ctx.fillStyle = element.styles.color;
	ctx.textAlign = element.styles.horizontalAlign;
	ctx.textBaseline = 'top';

	if (!element.allowOverflow) {
		ctx.beginPath();
		ctx.rect(x, y, w, h);
		ctx.clip();
	}

	const lines = element.disableNewLine ? [text] : getWrappedLines(ctx, text, w);
	const lineHeight = fontSize * 1.2;
	const contentHeight = lines.length * lineHeight;
	const startY = computeVerticalY(y, h, contentHeight, lines.length, element.styles.verticalAlign);

	let textX = x;
	if (element.styles.horizontalAlign === 'center') textX = x + w / 2;
	else if (element.styles.horizontalAlign === 'right') textX = x + w;

	for (let i = 0; i < lines.length; i++) {
		const lineY = startY + i * lineHeight;
		ctx.fillText(lines[i], textX, lineY);

		// Draw underline
		if (element.styles.fontUnderline) {
			const metrics = ctx.measureText(lines[i]);
			const lineWidth = metrics.width;
			let underlineX = textX;
			if (element.styles.horizontalAlign === 'center') underlineX = textX - lineWidth / 2;
			else if (element.styles.horizontalAlign === 'right') underlineX = textX - lineWidth;

			ctx.beginPath();
			ctx.strokeStyle = element.styles.color;
			ctx.lineWidth = Math.max(1, fontSize / 16);
			ctx.moveTo(underlineX, lineY + fontSize);
			ctx.lineTo(underlineX + lineWidth, lineY + fontSize);
			ctx.stroke();
		}
	}

	ctx.restore();
}

/**
 * Draw a QR/barcode element on a canvas.
 */
async function drawCodeOnCanvas(
	ctx: CanvasRenderingContext2D,
	element: QrElement,
	rowData: Record<string, string>,
	quality: number
): Promise<void> {
	const value = rowData[element.placeholder] || 'SAMPLE';
	const x = element.position.x * quality;
	const y = element.position.y * quality;
	const w = element.size.width * quality;
	const h = element.size.height * quality;

	const tmpCanvas = document.createElement('canvas');

	if (element.codeSettings.codeType === 'qr') {
		const size = Math.min(w, h);
		await generateQR(tmpCanvas, value, size, element.codeSettings.background, element.codeSettings.foreground);

		// Add logo overlay if present
		if (element.codeSettings.customLogo) {
			await addLogoToQR(tmpCanvas, size, element.codeSettings.customLogo);
		}
	} else {
		await generateBarcode(tmpCanvas, value, {
			format: element.codeSettings.barcodeType,
			height: h * 0.7,
			background: element.codeSettings.background,
			foreground: element.codeSettings.foreground
		});
	}

	ctx.drawImage(tmpCanvas, x, y, w, h);
}

/**
 * Render a complete ticket to a canvas for a given CSV row.
 */
export async function renderTicketToCanvas(
	elements: TicketElement[],
	rowData: Record<string, string>,
	options: {
		width: number;
		height: number;
		quality: number;
		backgroundImage?: string | null;
		fitMode?: BackgroundFitMode;
		labelConfig?: LabelConfig;
	}
): Promise<HTMLCanvasElement> {
	const canvas = document.createElement('canvas');
	const q = options.quality;
	canvas.width = options.width * q;
	canvas.height = options.height * q;
	const ctx = canvas.getContext('2d')!;

	// White background
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Background image
	if (options.backgroundImage) {
		await new Promise<void>((resolve) => {
			const img = new Image();
			img.onload = () => {
				drawBackgroundOnCanvas(ctx, img, canvas.width, canvas.height, options.fitMode || 'cover');
				resolve();
			};
			img.onerror = () => resolve();
			img.src = options.backgroundImage!;
		});
	}

	// Label color block
	if (options.labelConfig) {
		const labelData = getLabelBlockRenderData(rowData, options.labelConfig);
		if (labelData) {
			ctx.fillStyle = labelData.color;
			ctx.fillRect(0, 0, labelData.width * q, canvas.height);

			if (labelData.rightEnabled) {
				ctx.fillRect(canvas.width - labelData.rightWidth * q, 0, labelData.rightWidth * q, canvas.height);
			}
		}
	}

	// Elements
	for (const el of elements) {
		if (el.type === 'text') {
			drawTextOnCanvas(ctx, el, rowData, q);
		} else {
			await drawCodeOnCanvas(ctx, el, rowData, q);
		}
	}

	return canvas;
}
