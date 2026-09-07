import { db } from '$lib/server/db';
import { requireAdmin } from '$lib/server/forms';
import type { Player, Attempt } from '$lib/server/domain';
import { error } from '@sveltejs/kit';
export const load = async (e) => {
	requireAdmin(e);
	const p = await db().collection<Player>('players').findOne({ _id: e.params.id });
	if (!p) error(404, 'Player not found.');
	return {
		profile: { nickname: p.nickname, joined: p.createdAt.toISOString() },
		attempts: (
			await db()
				.collection<Attempt>('attempts')
				.find({ playerId: p._id })
				.sort({ startedAt: -1 })
				.toArray()
		).map((a) => ({
			id: a._id,
			contestId: a.contestId,
			text: a.snapshot.text,
			status: a.status,
			correct: !!a.correct,
			elapsedMs: a.elapsedMs ?? null
		})),
		events: (
			await db()
				.collection('auditEvents')
				.find({ actor: p._id })
				.sort({ at: -1 })
				.limit(100)
				.toArray()
		).map((a) => ({ action: a.action, at: a.at.toISOString() }))
	};
};
