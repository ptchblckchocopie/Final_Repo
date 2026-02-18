import { describe, it, expect, beforeEach } from 'vitest';
import { getTicketGap, setTicketGap } from './print-settings.svelte';
import { getIsDirty, markClean } from './dirty.svelte';

describe('print-settings store', () => {
	beforeEach(() => {
		setTicketGap(2);
		markClean();
	});

	it('defaults to gap of 2', () => {
		expect(getTicketGap()).toBe(2);
	});

	it('setTicketGap sets valid value', () => {
		setTicketGap(10);
		expect(getTicketGap()).toBe(10);
	});

	it('clamps below 0 to 0', () => {
		setTicketGap(-5);
		expect(getTicketGap()).toBe(0);
	});

	it('clamps above 20 to 20', () => {
		setTicketGap(50);
		expect(getTicketGap()).toBe(20);
	});

	it('setTicketGap marks dirty', () => {
		expect(getIsDirty()).toBe(false);
		setTicketGap(5);
		expect(getIsDirty()).toBe(true);
	});

	it('allows boundary values 0 and 20', () => {
		setTicketGap(0);
		expect(getTicketGap()).toBe(0);
		setTicketGap(20);
		expect(getTicketGap()).toBe(20);
	});
});
