import { timingSafeEqual } from 'node:crypto';
import { json, error } from '@sveltejs/kit';
import { reconcile } from '$lib/server/contests';
export const GET = async ({ request }) => {
	const secret = process.env.CRON_SECRET;
	const supplied = Buffer.from(request.headers.get('authorization') || '');
	const expected = Buffer.from(`Bearer ${secret}`);
	if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
		error(401, 'Unauthorized');
	await reconcile();
	return json({ ok: true });
};
