import { describe, it, expect, beforeEach } from 'vitest';
import {
	getZoom, setZoom, zoomIn, zoomOut, resetZoom,
	getBackgroundImage, setBackgroundImage,
	getBackgroundFitMode, setBackgroundFitMode
} from './canvas.svelte';
import { getIsDirty, markClean } from './dirty.svelte';

describe('canvas store', () => {
	beforeEach(() => {
		resetZoom();
		setBackgroundImage(null);
		setBackgroundFitMode('cover');
		markClean();
	});

	describe('zoom', () => {
		it('defaults to 1', () => {
			expect(getZoom()).toBe(1);
		});

		it('setZoom sets valid value', () => {
			setZoom(2);
			expect(getZoom()).toBe(2);
		});

		it('clamps to minimum 0.25', () => {
			setZoom(0.1);
			expect(getZoom()).toBe(0.25);
		});

		it('clamps to maximum 3', () => {
			setZoom(5);
			expect(getZoom()).toBe(3);
		});

		it('zoomIn increments by 0.25', () => {
			zoomIn();
			expect(getZoom()).toBe(1.25);
		});

		it('zoomOut decrements by 0.25', () => {
			zoomOut();
			expect(getZoom()).toBe(0.75);
		});

		it('zoomIn at max stays at 3', () => {
			setZoom(3);
			zoomIn();
			expect(getZoom()).toBe(3);
		});

		it('zoomOut at min stays at 0.25', () => {
			setZoom(0.25);
			zoomOut();
			expect(getZoom()).toBe(0.25);
		});

		it('resetZoom sets back to 1', () => {
			setZoom(2.5);
			resetZoom();
			expect(getZoom()).toBe(1);
		});
	});

	describe('background image', () => {
		it('defaults to null', () => {
			expect(getBackgroundImage()).toBeNull();
		});

		it('setBackgroundImage stores value', () => {
			setBackgroundImage('data:image/png;base64,abc');
			expect(getBackgroundImage()).toBe('data:image/png;base64,abc');
		});

		it('setBackgroundImage(null) clears it', () => {
			setBackgroundImage('data:...');
			setBackgroundImage(null);
			expect(getBackgroundImage()).toBeNull();
		});

		it('setBackgroundImage marks dirty', () => {
			markClean();
			setBackgroundImage('data:...');
			expect(getIsDirty()).toBe(true);
		});
	});

	describe('background fit mode', () => {
		it('defaults to cover', () => {
			expect(getBackgroundFitMode()).toBe('cover');
		});

		it('setBackgroundFitMode changes value', () => {
			setBackgroundFitMode('contain');
			expect(getBackgroundFitMode()).toBe('contain');
		});

		it('setBackgroundFitMode marks dirty', () => {
			markClean();
			setBackgroundFitMode('stretch');
			expect(getIsDirty()).toBe(true);
		});
	});

	it('setZoom does NOT mark dirty', () => {
		markClean();
		setZoom(2);
		expect(getIsDirty()).toBe(false);
	});
});
