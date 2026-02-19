import { env } from '$env/dynamic/public';
import type { HandleFetch } from '@sveltejs/kit';

export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	const payloadUrl = env.PUBLIC_PAYLOAD_URL;
	const url = new URL(request.url);
	if (url.pathname.startsWith('/api/') && payloadUrl) {
		const backendUrl = `${payloadUrl}${url.pathname}${url.search}`;
		return fetch(new Request(backendUrl, request));
	}
	return fetch(request);
};
