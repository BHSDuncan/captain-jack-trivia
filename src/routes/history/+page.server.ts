import { db } from '$lib/server/db';
import type { Contest, Standing } from '$lib/server/domain';
export const load = async () => {
	if (!process.env.MONGODB_URI) return { contests: [] };
	const contests = await db()
		.collection<Contest>('contests')
		.find({ state: 'closed' })
		.sort({ startsAt: -1 })
		.toArray();
	const results = await db()
		.collection<{ _id: string; standings: Standing[]; winnerIds: string[] }>('contestResults')
		.find({ _id: { $in: contests.map((c) => c._id) } })
		.toArray();
	return {
		contests: contests.map((c) => ({
			id: c._id,
			title: c.title,
			month: c.month,
			winners:
				results
					.find((r) => r._id === c._id)
					?.standings.filter((r) =>
						results.find((x) => x._id === c._id)?.winnerIds.includes(r.playerId)
					)
					.map((r) => r.nickname) ?? []
		}))
	};
};
