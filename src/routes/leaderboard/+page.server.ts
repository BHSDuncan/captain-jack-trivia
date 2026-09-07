import { db } from '$lib/server/db';
import { standings } from '$lib/server/contests';
import type { Contest } from '$lib/server/domain';
export const load = async () => {
	if (!process.env.MONGODB_URI) return { contest: null, rows: [] };
	const c = await db()
		.collection<Contest>('contests')
		.findOne({ state: { $in: ['active', 'paused'] } });
	const rows = c ? await standings(c._id) : [];
	return {
		contest: c ? { title: c.title, month: c.month } : null,
		rows: rows
			.map((r) => ({ nickname: r.nickname, correct: r.correct }))
			.sort((a, b) => b.correct - a.correct || a.nickname.localeCompare(b.nickname))
	};
};
