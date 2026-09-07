import { db } from '$lib/server/db';
import type { Contest } from '$lib/server/domain';
import { requireAdmin } from '$lib/server/forms';
import { adminAuth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import { standings } from '$lib/server/contests';
export const load = async (event) => {
	requireAdmin(event);
	const contests = await db()
		.collection<Contest>('contests')
		.find()
		.sort({ startsAt: -1 })
		.toArray();
	const current = contests.find((c) => c.state === 'active' || c.state === 'paused');
	const currentStandings = current ? await standings(current._id) : [];
	return {
		contests: contests.map((c) => ({ id: c._id, title: c.title, month: c.month, state: c.state })),
		players: await db().collection('players').countDocuments(),
		participants: currentStandings.length,
		attempts: await db().collection('attempts').countDocuments(),
		events: (await db().collection('auditEvents').find().sort({ at: -1 }).limit(30).toArray()).map(
			(e) => ({
				id: String(e._id),
				at: e.at.toISOString(),
				action: e.action,
				actor: e.actor,
				detail: JSON.stringify(e.detail)
			})
		),
		leaders: currentStandings.slice(0, 5)
	};
};
export const actions = {
	logout: async (event) => {
		requireAdmin(event);
		await adminAuth().api.signOut({ headers: event.request.headers });
		for (const c of event.cookies.getAll())
			if (c.name.includes('better-auth')) event.cookies.delete(c.name, { path: '/' });
		redirect(303, '/admin/login');
	}
};
