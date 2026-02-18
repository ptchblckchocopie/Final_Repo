export const BASE_URL = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';

export async function payloadFetch<T>(
	endpoint: string,
	options?: RequestInit
): Promise<T> {
	// SEC-NEW-1: Always route through BASE_URL to prevent SSRF bypass
	const url = `${BASE_URL}${endpoint}`;

	const isFormData = options?.body instanceof FormData;

	const res = await fetch(url, {
		...options,
		headers: {
			...(isFormData ? {} : { 'Content-Type': 'application/json' }),
			...options?.headers
		}
	});

	if (!res.ok) {
		// SEC-H4: Log full error for debugging, but sanitize what's thrown to caller
		const errorBody = await res.text().catch(() => '');
		console.error(`API error [${res.status}] ${endpoint}:`, errorBody);
		throw new Error(`Request failed (${res.status})`);
	}

	return res.json();
}
