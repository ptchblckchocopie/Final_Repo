import type { PayloadCallSignal, PaginatedResponse } from '$lib/types/payload';
import { payloadFetch } from './client';

export async function createCallSignal(data: {
	callId: string;
	from: string;
	to: string;
	type: PayloadCallSignal['type'];
	data?: Record<string, unknown> | null;
	status?: PayloadCallSignal['status'];
}): Promise<PayloadCallSignal> {
	return payloadFetch<PayloadCallSignal>('/api/call-signals', {
		method: 'POST',
		body: JSON.stringify(data),
	});
}

export async function getCallSignals(
	callId: string
): Promise<PaginatedResponse<PayloadCallSignal>> {
	const params = new URLSearchParams({
		'where[callId][equals]': callId,
		sort: 'createdAt',
		limit: '100',
	});
	return payloadFetch<PaginatedResponse<PayloadCallSignal>>(
		`/api/call-signals?${params.toString()}`
	);
}

export async function getIncomingCalls(
	username: string
): Promise<PaginatedResponse<PayloadCallSignal>> {
	const params = new URLSearchParams({
		'where[to][equals]': username,
		'where[type][equals]': 'offer',
		'where[status][equals]': 'pending',
		'where[createdAt][greater_than]': new Date(Date.now() - 30_000).toISOString(),
		sort: '-createdAt',
		limit: '10',
	});
	return payloadFetch<PaginatedResponse<PayloadCallSignal>>(
		`/api/call-signals?${params.toString()}`
	);
}

export async function updateCallSignalStatus(
	id: number,
	status: PayloadCallSignal['status']
): Promise<PayloadCallSignal> {
	return payloadFetch<PayloadCallSignal>(`/api/call-signals/${id}`, {
		method: 'PATCH',
		body: JSON.stringify({ status }),
	});
}

export async function getNewCallSignals(
	callId: string,
	afterTimestamp: string
): Promise<PaginatedResponse<PayloadCallSignal>> {
	const params = new URLSearchParams({
		'where[callId][equals]': callId,
		'where[createdAt][greater_than]': afterTimestamp,
		sort: 'createdAt',
		limit: '100',
	});
	return payloadFetch<PaginatedResponse<PayloadCallSignal>>(
		`/api/call-signals?${params.toString()}`
	);
}
