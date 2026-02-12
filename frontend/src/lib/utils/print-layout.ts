import type { TicketType, LayoutResult } from '$lib/types/ticket';

const A4_WIDTH = 210; // mm
const A4_HEIGHT = 297; // mm
const MARGIN = 10; // mm

/**
 * Calculate the print layout for a given ticket size and gap.
 */
export function calculateLayout(
	ticketWidth: number,
	ticketHeight: number,
	gap: number,
	ticketType: TicketType,
	totalTickets: number
): LayoutResult {
	let ticketsPerRow: number;
	let ticketsPerCol: number;
	let orientation: 'landscape' | 'portrait';

	switch (ticketType) {
		case 'ticket':
			ticketsPerRow = 2;
			ticketsPerCol = 4;
			orientation = 'landscape';
			break;
		case 'convention-id':
			ticketsPerRow = 2;
			ticketsPerCol = 2;
			orientation = 'portrait';
			break;
		case 'certificate':
			ticketsPerRow = 1;
			ticketsPerCol = 1;
			orientation = 'landscape';
			break;
		case 'others':
		default: {
			// For custom sizes, dynamically calculate
			const landscape = ticketWidth > ticketHeight;
			orientation = landscape ? 'landscape' : 'portrait';
			const pageW = landscape ? A4_HEIGHT : A4_WIDTH;
			const pageH = landscape ? A4_WIDTH : A4_HEIGHT;
			const availW = pageW - MARGIN * 2;
			const availH = pageH - MARGIN * 2;
			ticketsPerRow = Math.max(1, Math.floor((availW + gap) / (ticketWidth + gap)));
			ticketsPerCol = Math.max(1, Math.floor((availH + gap) / (ticketHeight + gap)));
			break;
		}
	}

	const pageW = orientation === 'landscape' ? A4_HEIGHT : A4_WIDTH;
	const pageH = orientation === 'landscape' ? A4_WIDTH : A4_HEIGHT;
	const availableWidth = pageW - MARGIN * 2;
	const availableHeight = pageH - MARGIN * 2;

	const ticketsPerPage = ticketsPerRow * ticketsPerCol;
	const totalPages = Math.ceil(totalTickets / ticketsPerPage);

	return {
		ticketsPerRow,
		ticketsPerCol,
		ticketsPerPage,
		totalPages,
		orientation,
		availableWidth,
		availableHeight
	};
}

/**
 * Generate cut line positions for a page layout.
 */
export function getCutLinePositions(
	ticketWidth: number,
	ticketHeight: number,
	gap: number,
	layout: LayoutResult
): { vertical: number[]; horizontal: number[] } {
	const vertical: number[] = [];
	const horizontal: number[] = [];

	for (let col = 0; col <= layout.ticketsPerRow; col++) {
		vertical.push(MARGIN + col * (ticketWidth + gap) - gap / 2);
	}

	for (let row = 0; row <= layout.ticketsPerCol; row++) {
		horizontal.push(MARGIN + row * (ticketHeight + gap) - gap / 2);
	}

	return { vertical, horizontal };
}
