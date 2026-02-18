import { describe, it, expect, beforeEach } from 'vitest';
import {
	getLabelConfig, setLabelColumn, assignLabelColor,
	setLabelBlockWidth, setRightBlockEnabled, setRightBlockWidth,
	setAllLabelConfig, getUniqueLabelValues
} from './labels.svelte';
import { getIsDirty, markClean } from './dirty.svelte';
import type { LabelConfig } from '$lib/types/ticket';

const DEFAULT_CONFIG: LabelConfig = {
	labelColumn: '',
	labelColors: {},
	labelBlockWidth: 50,
	rightBlockEnabled: false,
	rightBlockWidth: 20
};

describe('labels store', () => {
	beforeEach(() => {
		setAllLabelConfig(DEFAULT_CONFIG);
		markClean();
	});

	it('returns correct defaults', () => {
		const config = getLabelConfig();
		expect(config.labelColumn).toBe('');
		expect(config.labelColors).toEqual({});
		expect(config.labelBlockWidth).toBe(50);
		expect(config.rightBlockEnabled).toBe(false);
		expect(config.rightBlockWidth).toBe(20);
	});

	it('setLabelColumn sets column and clears colors', () => {
		assignLabelColor('VIP', '#ff0000');
		setLabelColumn('Type');
		const config = getLabelConfig();
		expect(config.labelColumn).toBe('Type');
		expect(config.labelColors).toEqual({});
	});

	it('assignLabelColor adds color mapping', () => {
		assignLabelColor('VIP', '#ff0000');
		expect(getLabelConfig().labelColors).toEqual({ VIP: '#ff0000' });
	});

	it('assignLabelColor preserves other colors', () => {
		assignLabelColor('VIP', '#ff0000');
		assignLabelColor('Regular', '#00ff00');
		expect(getLabelConfig().labelColors).toEqual({
			VIP: '#ff0000',
			Regular: '#00ff00'
		});
	});

	describe('labelBlockWidth clamping', () => {
		it('sets valid width', () => {
			setLabelBlockWidth(40);
			expect(getLabelConfig().labelBlockWidth).toBe(40);
		});

		it('clamps below 5 to 5', () => {
			setLabelBlockWidth(2);
			expect(getLabelConfig().labelBlockWidth).toBe(5);
		});

		it('clamps above 80 to 80', () => {
			setLabelBlockWidth(100);
			expect(getLabelConfig().labelBlockWidth).toBe(80);
		});
	});

	it('setRightBlockEnabled toggles', () => {
		setRightBlockEnabled(true);
		expect(getLabelConfig().rightBlockEnabled).toBe(true);
	});

	describe('rightBlockWidth clamping', () => {
		it('sets valid width', () => {
			setRightBlockWidth(30);
			expect(getLabelConfig().rightBlockWidth).toBe(30);
		});

		it('clamps below 5', () => {
			setRightBlockWidth(1);
			expect(getLabelConfig().rightBlockWidth).toBe(5);
		});

		it('clamps above 80', () => {
			setRightBlockWidth(99);
			expect(getLabelConfig().rightBlockWidth).toBe(80);
		});
	});

	it('setAllLabelConfig replaces all fields', () => {
		const custom: LabelConfig = {
			labelColumn: 'Cat',
			labelColors: { A: '#111' },
			labelBlockWidth: 30,
			rightBlockEnabled: true,
			rightBlockWidth: 40
		};
		setAllLabelConfig(custom);
		const config = getLabelConfig();
		expect(config.labelColumn).toBe('Cat');
		expect(config.labelColors).toEqual({ A: '#111' });
		expect(config.labelBlockWidth).toBe(30);
		expect(config.rightBlockEnabled).toBe(true);
		expect(config.rightBlockWidth).toBe(40);
	});

	describe('getUniqueLabelValues', () => {
		it('returns unique values from CSV data', () => {
			setLabelColumn('category');
			const csv = [
				{ category: 'A' },
				{ category: 'B' },
				{ category: 'A' }
			];
			const values = getUniqueLabelValues(csv);
			expect(values).toHaveLength(2);
			expect(values).toContain('A');
			expect(values).toContain('B');
		});

		it('returns empty when no column selected', () => {
			expect(getUniqueLabelValues([{ x: '1' }])).toEqual([]);
		});

		it('skips falsy values', () => {
			setLabelColumn('col');
			const csv = [{ col: 'A' }, { col: '' }, { col: 'B' }];
			expect(getUniqueLabelValues(csv)).toHaveLength(2);
		});
	});

	it('mutating functions mark dirty', () => {
		expect(getIsDirty()).toBe(false);
		setLabelColumn('test');
		expect(getIsDirty()).toBe(true);
	});
});
