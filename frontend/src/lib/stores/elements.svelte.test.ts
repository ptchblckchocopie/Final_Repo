import { describe, it, expect, beforeEach } from 'vitest';
import {
	getElements,
	addTextElement,
	addQrElement,
	updateElement,
	removeElement,
	removeElements,
	clearElements,
	setElements,
	getElementByIndex,
	getElementById,
	snapshotElements,
	restoreElements
} from './elements.svelte';
import { getIsDirty, markClean } from './dirty.svelte';

describe('elements store', () => {
	beforeEach(() => {
		clearElements();
		markClean();
	});

	it('starts with empty array', () => {
		expect(getElements()).toEqual([]);
	});

	it('addTextElement adds element with defaults', () => {
		const el = addTextElement();
		expect(el.type).toBe('text');
		expect(el.id).toBeDefined();
		expect(el.position).toEqual({ x: 10, y: 10 });
		expect(getElements()).toHaveLength(1);
	});

	it('addTextElement applies overrides', () => {
		const el = addTextElement({ textFormat: '{Name}', rotation: 45 });
		expect(el.textFormat).toBe('{Name}');
		expect(el.rotation).toBe(45);
	});

	it('addQrElement adds element with defaults', () => {
		const el = addQrElement();
		expect(el.type).toBe('qr');
		expect(el.size).toEqual({ width: 80, height: 80 });
		expect(getElements()).toHaveLength(1);
	});

	it('addQrElement applies overrides', () => {
		const el = addQrElement({ placeholder: '{ID}' });
		expect(el.placeholder).toBe('{ID}');
	});

	it('updateElement merges partial updates by id', () => {
		const el = addTextElement();
		updateElement(el.id, { rotation: 90 });
		expect(getElementById(el.id)?.rotation).toBe(90);
	});

	it('updateElement with non-existent id is a no-op', () => {
		addTextElement();
		updateElement('nonexistent', { rotation: 90 });
		expect(getElements()).toHaveLength(1);
	});

	it('removeElement removes by id', () => {
		const el = addTextElement();
		removeElement(el.id);
		expect(getElements()).toHaveLength(0);
	});

	it('removeElement with non-existent id keeps elements unchanged', () => {
		addTextElement();
		removeElement('nonexistent');
		expect(getElements()).toHaveLength(1);
	});

	it('removeElements removes multiple by Set', () => {
		const el1 = addTextElement();
		const el2 = addTextElement();
		addTextElement();
		removeElements(new Set([el1.id, el2.id]));
		expect(getElements()).toHaveLength(1);
	});

	it('clearElements empties array', () => {
		addTextElement();
		addTextElement();
		clearElements();
		expect(getElements()).toHaveLength(0);
	});

	it('setElements replaces all elements with spread copy', () => {
		addTextElement();
		const newEls = [{ id: 'a', type: 'text' as const, position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, rotation: 0, textFormat: 'test', styles: { fontSize: 16, color: '#000', fontFamily: 'Arial', fontBold: false, fontItalic: false, fontUnderline: false, backgroundColor: '', opacity: 1, horizontalAlign: 'left' as const, verticalAlign: 'top' as const }, containInBox: true, allowOverflow: false, disableNewLine: false }];
		setElements(newEls);
		expect(getElements()).toHaveLength(1);
		expect(getElements()[0].id).toBe('a');
	});

	it('getElementByIndex returns correct element', () => {
		const el = addTextElement();
		expect(getElementByIndex(0)?.id).toBe(el.id);
	});

	it('getElementByIndex returns undefined for out-of-range', () => {
		expect(getElementByIndex(99)).toBeUndefined();
	});

	it('getElementById finds by id', () => {
		const el = addTextElement();
		expect(getElementById(el.id)?.id).toBe(el.id);
	});

	it('getElementById returns undefined when not found', () => {
		expect(getElementById('nonexistent')).toBeUndefined();
	});

	it('snapshotElements returns deep clone', () => {
		addTextElement({ textFormat: 'original' });
		const snapshot = snapshotElements();
		snapshot[0].textFormat = 'modified';
		expect(getElements()[0].textFormat).toBe('original');
	});

	it('restoreElements replaces state', () => {
		addTextElement();
		addTextElement();
		const snapshot = snapshotElements();
		clearElements();
		restoreElements(snapshot);
		expect(getElements()).toHaveLength(2);
	});

	it('mutating functions call markDirty', () => {
		markClean();
		expect(getIsDirty()).toBe(false);
		addTextElement();
		expect(getIsDirty()).toBe(true);
	});
});
