import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToasts, showToast, closeToast } from './toast.svelte';

describe('toast store', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Clear all toasts by closing them
		for (const t of getToasts()) {
			closeToast(t.id);
		}
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts with empty toasts', () => {
		expect(getToasts()).toHaveLength(0);
	});

	it('showToast adds a toast with correct properties', () => {
		showToast('success', 'Title', 'Message', 4000);
		const toasts = getToasts();
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe('success');
		expect(toasts[0].title).toBe('Title');
		expect(toasts[0].message).toBe('Message');
		expect(toasts[0].duration).toBe(4000);
		expect(toasts[0].id).toBeDefined();
	});

	it('showToast auto-dismisses after duration', () => {
		showToast('info', 'Auto', '', 3000);
		expect(getToasts()).toHaveLength(1);
		vi.advanceTimersByTime(3000);
		expect(getToasts()).toHaveLength(0);
	});

	it('showToast with duration=0 does NOT auto-dismiss', () => {
		showToast('warning', 'Persistent', '', 0);
		expect(getToasts()).toHaveLength(1);
		vi.advanceTimersByTime(10000);
		expect(getToasts()).toHaveLength(1);
	});

	it('closeToast removes specific toast by id', () => {
		showToast('success', 'A', '', 0);
		showToast('error', 'B', '', 0);
		const toasts = getToasts();
		expect(toasts).toHaveLength(2);
		closeToast(toasts[0].id);
		expect(getToasts()).toHaveLength(1);
		expect(getToasts()[0].title).toBe('B');
	});

	it('closeToast with non-existent id is a no-op', () => {
		showToast('info', 'Test', '', 0);
		closeToast('nonexistent');
		expect(getToasts()).toHaveLength(1);
	});

	it('multiple toasts can coexist', () => {
		showToast('success', 'A', '', 0);
		showToast('error', 'B', '', 0);
		showToast('warning', 'C', '', 0);
		expect(getToasts()).toHaveLength(3);
	});

	it('showToast defaults message to empty string', () => {
		showToast('info', 'NoMsg');
		const toasts = getToasts();
		expect(toasts[0].message).toBe('');
	});

	it('each toast has a unique id', () => {
		showToast('info', 'A', '', 0);
		showToast('info', 'B', '', 0);
		const [a, b] = getToasts();
		expect(a.id).not.toBe(b.id);
	});
});
