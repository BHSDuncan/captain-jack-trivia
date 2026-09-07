import { fail, redirect, error, type RequestEvent } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { RuleError } from './domain';
export const text = (f: FormData, key: string) => String(f.get(key) ?? '');
export function failure(e: unknown) {
	if (e instanceof RuleError) return fail(e.status, { error: e.message });
	if (e instanceof ZodError) return fail(400, { error: e.issues.map((i) => i.message).join(' ') });
	if ((e as { code?: number })?.code === 11000)
		return fail(400, { error: 'This record already exists.' });
	console.error(
		JSON.stringify({ event: 'request.failed', type: e instanceof Error ? e.name : 'unknown' })
	);
	return fail(500, { error: 'Unable to save. Please try again.' });
}
export function requireAdmin(event: RequestEvent) {
	if (!event.locals.admin) redirect(303, '/admin/login');
	return event.locals.admin;
}
export function requirePlayer(event: RequestEvent) {
	if (!event.locals.barNetwork) error(403, 'Join Captain Jack’s Wi-Fi to play.');
	if (!event.locals.player) redirect(303, '/join');
	return event.locals.player;
}
