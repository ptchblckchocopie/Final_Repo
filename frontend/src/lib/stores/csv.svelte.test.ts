import { describe, it, expect, beforeEach } from 'vitest';
import { getCsvData, getCsvHeaders, loadCSV, setCsvDirect, clearCSV, getCsvRowCount } from './csv.svelte';
import { getIsDirty, markClean } from './dirty.svelte';

describe('csv store', () => {
	beforeEach(() => {
		clearCSV();
		markClean();
	});

	it('starts with empty data and headers', () => {
		expect(getCsvData()).toEqual([]);
		expect(getCsvHeaders()).toEqual([]);
	});

	it('loadCSV parses text and sets headers + data', () => {
		loadCSV('Name,Age\nAlice,30\nBob,25');
		expect(getCsvHeaders()).toEqual(['Name', 'Age']);
		expect(getCsvData()).toEqual([
			{ Name: 'Alice', Age: '30' },
			{ Name: 'Bob', Age: '25' }
		]);
	});

	it('loadCSV throws on empty CSV', () => {
		expect(() => loadCSV('')).toThrow('CSV file is empty');
	});

	it('setCsvDirect sets data and headers directly', () => {
		setCsvDirect([{ A: '1' }], ['A']);
		expect(getCsvData()).toEqual([{ A: '1' }]);
		expect(getCsvHeaders()).toEqual(['A']);
	});

	it('clearCSV resets to empty', () => {
		loadCSV('X\n1');
		clearCSV();
		expect(getCsvData()).toEqual([]);
		expect(getCsvHeaders()).toEqual([]);
	});

	it('getCsvRowCount returns correct count', () => {
		loadCSV('Name\nA\nB\nC');
		expect(getCsvRowCount()).toBe(3);
	});

	it('loadCSV marks dirty', () => {
		expect(getIsDirty()).toBe(false);
		loadCSV('X\n1');
		expect(getIsDirty()).toBe(true);
	});

	it('clearCSV marks dirty', () => {
		loadCSV('X\n1');
		markClean();
		clearCSV();
		expect(getIsDirty()).toBe(true);
	});
});
