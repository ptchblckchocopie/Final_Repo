import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock elements.svelte to isolate history logic
let mockSnapshot: any[] = [];
let mockRestored: any[] | null = null;

vi.mock('./elements.svelte', () => ({
	snapshotElements: () => JSON.parse(JSON.stringify(mockSnapshot)),
	restoreElements: (els: any[]) => { mockRestored = els; }
}));

import { pushState, undo, redo, canUndo, canRedo, clearHistory } from './history.svelte';

describe('history store', () => {
	beforeEach(() => {
		clearHistory();
		mockSnapshot = [];
		mockRestored = null;
	});

	it('starts with no undo/redo', () => {
		expect(canUndo()).toBe(false);
		expect(canRedo()).toBe(false);
	});

	it('pushState enables undo', () => {
		mockSnapshot = [{ id: '1' }];
		pushState();
		expect(canUndo()).toBe(true);
		expect(canRedo()).toBe(false);
	});

	it('undo restores previous state', () => {
		mockSnapshot = [{ id: 'before' }];
		pushState();
		mockSnapshot = [{ id: 'after' }];
		undo();
		expect(mockRestored).toEqual([{ id: 'before' }]);
	});

	it('undo enables redo', () => {
		mockSnapshot = [{ id: '1' }];
		pushState();
		mockSnapshot = [{ id: '2' }];
		undo();
		expect(canRedo()).toBe(true);
	});

	it('redo restores forward state', () => {
		mockSnapshot = [{ id: 'first' }];
		pushState();
		mockSnapshot = [{ id: 'second' }];
		undo();
		// mockRestored now has 'first', but redo should push current snapshot and restore the redo entry
		mockRestored = null;
		mockSnapshot = [{ id: 'first' }]; // current state after undo
		redo();
		expect(mockRestored).toEqual([{ id: 'second' }]);
	});

	it('pushState clears redo stack', () => {
		mockSnapshot = [{ id: '1' }];
		pushState();
		mockSnapshot = [{ id: '2' }];
		undo();
		// Now we have redo available
		expect(canRedo()).toBe(true);
		mockSnapshot = [{ id: '3' }];
		pushState();
		expect(canRedo()).toBe(false);
	});

	it('undo with empty stack is a no-op', () => {
		undo();
		expect(mockRestored).toBeNull();
	});

	it('redo with empty stack is a no-op', () => {
		redo();
		expect(mockRestored).toBeNull();
	});

	it('caps at MAX_UNDO_STATES (50)', () => {
		for (let i = 0; i < 55; i++) {
			mockSnapshot = [{ id: String(i) }];
			pushState();
		}
		// Should have exactly 50 states
		let undoCount = 0;
		while (canUndo()) {
			mockSnapshot = [];
			undo();
			undoCount++;
		}
		expect(undoCount).toBe(50);
	});

	it('clearHistory resets both stacks', () => {
		mockSnapshot = [{ id: '1' }];
		pushState();
		pushState();
		undo();
		expect(canUndo()).toBe(true);
		expect(canRedo()).toBe(true);
		clearHistory();
		expect(canUndo()).toBe(false);
		expect(canRedo()).toBe(false);
	});
});
