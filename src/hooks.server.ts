import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { adminAuth } from '$lib/server/auth';
import { playerFromCookies } from '$lib/server/identity';
import { onBarNetwork } from '$lib/server/network';
import { reconcile } from '$lib/server/contests';
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.player = null;
	event.locals.admin = null;
	event.locals.barNetwork = false;
	if (building) return resolve(event);
	if (
		!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method) &&
		event.request.headers.get('origin') !== event.url.origin
	) {
		return new Response('Cross-origin requests are not permitted.', { status: 403 });
	}
	const path = event.url.pathname;
	if (path.startsWith('/api/auth/')) return adminAuth().handler(event.request);
	event.locals.barNetwork = await onBarNetwork(event.request.headers, process.env,
		process.env.NETWORK_DIAGNOSTICS === 'true' && ['/', '/join'].includes(path)
			? (value) => { event.locals.networkDiagnostic = value; }
			: undefined);
	if (process.env.MONGODB_URI) {
		if (path.startsWith('/admin')) {
			const session = await adminAuth().api.getSession({ headers: event.request.headers });
			event.locals.admin = session?.user ?? null;
		} else event.locals.player = await playerFromCookies(event.cookies);
		if (!path.startsWith('/api/cron')) await reconcile();
	}
	const response = await resolve(event);
	response.headers.set('cache-control', 'private, no-store');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};
