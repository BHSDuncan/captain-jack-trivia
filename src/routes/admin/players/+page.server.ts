import { db } from '$lib/server/db';
import { requireAdmin } from '$lib/server/forms';
import type { Player } from '$lib/server/domain';
export const load = async (e) => {
	requireAdmin(e);
	return {
		players: (
			await db().collection<Player>('players').find().sort({ createdAt: -1 }).toArray()
		).map((p) => ({ id: p._id, nickname: p.nickname, createdAt: p.createdAt.toISOString() }))
	};
};
