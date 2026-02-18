import { describe, it, expect, beforeEach } from 'vitest';
import { getTicketSettings, setTicketType, setCustomSize, setFitMode, setAllSettings } from './ticket-settings.svelte';
import { TICKET_PRESETS } from '$lib/types/ticket';
import { getIsDirty, markClean } from './dirty.svelte';

describe('ticket-settings store', () => {
	beforeEach(() => {
		setAllSettings({
			type: 'ticket',
			width: TICKET_PRESETS.ticket.width,
			height: TICKET_PRESETS.ticket.height,
			fitMode: 'cover'
		});
		markClean();
	});

	it('defaults to ticket preset', () => {
		const s = getTicketSettings();
		expect(s.type).toBe('ticket');
		expect(s.width).toBe(TICKET_PRESETS.ticket.width);
		expect(s.height).toBe(TICKET_PRESETS.ticket.height);
		expect(s.fitMode).toBe('cover');
	});

	it('setTicketType applies convention-id preset', () => {
		setTicketType('convention-id');
		const s = getTicketSettings();
		expect(s.type).toBe('convention-id');
		expect(s.width).toBe(TICKET_PRESETS['convention-id'].width);
		expect(s.height).toBe(TICKET_PRESETS['convention-id'].height);
	});

	it('setTicketType applies certificate preset', () => {
		setTicketType('certificate');
		const s = getTicketSettings();
		expect(s.type).toBe('certificate');
		expect(s.width).toBe(TICKET_PRESETS.certificate.width);
		expect(s.height).toBe(TICKET_PRESETS.certificate.height);
	});

	it('setTicketType others does NOT overwrite custom dims', () => {
		setCustomSize(200, 100);
		setTicketType('others');
		const s = getTicketSettings();
		expect(s.type).toBe('others');
		expect(s.width).toBe(200);
		expect(s.height).toBe(100);
	});

	it('setCustomSize sets dimensions', () => {
		setCustomSize(300, 150);
		const s = getTicketSettings();
		expect(s.width).toBe(300);
		expect(s.height).toBe(150);
	});

	it('setFitMode changes fit mode', () => {
		setFitMode('stretch');
		expect(getTicketSettings().fitMode).toBe('stretch');
	});

	it('setAllSettings replaces all', () => {
		setAllSettings({ type: 'certificate', width: 297, height: 210, fitMode: 'contain' });
		const s = getTicketSettings();
		expect(s.type).toBe('certificate');
		expect(s.fitMode).toBe('contain');
	});

	it('marks dirty on change', () => {
		expect(getIsDirty()).toBe(false);
		setTicketType('certificate');
		expect(getIsDirty()).toBe(true);
	});
});
