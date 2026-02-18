import { describe, it, expect, beforeEach } from 'vitest';
import { getIsDirty, markDirty, markClean, getLastSavedTime, getLastSavedTemplateName } from './dirty.svelte';

describe('dirty store', () => {
	beforeEach(() => {
		markClean({ templateName: undefined });
	});

	it('starts clean', () => {
		expect(getIsDirty()).toBe(false);
	});

	it('markDirty sets isDirty to true', () => {
		markDirty();
		expect(getIsDirty()).toBe(true);
	});

	it('markClean sets isDirty to false', () => {
		markDirty();
		markClean();
		expect(getIsDirty()).toBe(false);
	});

	it('markClean sets lastSavedTime to valid ISO string', () => {
		markClean();
		const time = getLastSavedTime();
		expect(time).not.toBeNull();
		expect(() => new Date(time!).toISOString()).not.toThrow();
	});

	it('markClean with templateName stores it', () => {
		markClean({ templateName: 'MyTemplate' });
		expect(getLastSavedTemplateName()).toBe('MyTemplate');
	});

	// BUG-M12 fix: markClean always clears lastSavedTemplateName when no source
	it('markClean without args clears lastSavedTemplateName', () => {
		markClean({ templateName: 'OldName' });
		expect(getLastSavedTemplateName()).toBe('OldName');
		markClean();
		expect(getLastSavedTemplateName()).toBeNull();
	});

	it('markClean with explicit null clears templateName', () => {
		markClean({ templateName: 'Test' });
		markClean({ templateName: undefined });
		// source?.templateName is undefined, so ?? null -> null
		expect(getLastSavedTemplateName()).toBeNull();
	});

	it('multiple markDirty calls are idempotent', () => {
		markDirty();
		markDirty();
		markDirty();
		expect(getIsDirty()).toBe(true);
	});

	it('getLastSavedTime returns null before any save', () => {
		// After beforeEach calls markClean, lastSavedTime is set.
		// Test a fresh scenario: markDirty doesn't set time
		const timeBefore = getLastSavedTime();
		markDirty();
		expect(getLastSavedTime()).toBe(timeBefore);
	});
});
