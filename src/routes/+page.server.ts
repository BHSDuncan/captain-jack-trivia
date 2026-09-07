import { db } from '$lib/server/db';
import { allowance, type Contest, type Attempt } from '$lib/server/domain';
export const load = async ({ locals }) => {
	if (!process.env.MONGODB_URI)
		return { setup: true, contest: null, active: null, used: 0, available: 0, wins: [] };
	const c = await db()
		.collection<Contest>('contests')
		.findOne({ state: { $in: ['active', 'paused'] } }, { sort: { startsAt: -1 } });
	const used =
		c && locals.player
			? await db()
					.collection<Attempt>('attempts')
					.countDocuments({ playerId: locals.player._id, contestId: c._id })
			: 0;
	const active =
		c && locals.player
			? await db()
					.collection<Attempt>('attempts')
					.findOne({ playerId: locals.player._id, contestId: c._id, status: 'active' })
			: null;
	const wins = locals.player
		? await db().collection('contestResults').find({ winnerIds: locals.player._id }).toArray()
		: [];
	const winnerContests = await db()
		.collection<Contest>('contests')
		.find({ _id: { $in: wins.map((w) => String(w._id)) }, state: 'closed' })
		.toArray();
	return {
		setup: false,
		contest: c
			? {
					id: c._id,
					title: c.title,
					month: c.month,
					state: c.state,
					rules: c.rules.replaceAll(
						'Exact ties share the prize.',
						'Exact ties result in joint winners.'
					),
					message: c.message,
					total: c.frozen.length,
					quota: c.questionsPerWeek
				}
			: null,
		active: !!active,
		used,
		available: c ? Math.max(0, allowance(c, new Date()) - used) : 0,
		wins: winnerContests.map((w) => ({
			id: w._id,
			month: w.month,
			title: w.title,
			message: w.winnerMessage
				.replaceAll(
					'Show this screen to the owner to arrange your prize.',
					'Show this screen to the owner.'
				)
				.replaceAll('{nickname}', locals.player!.nickname)
				.replaceAll('{month}', w.month)
		}))
	};
};
