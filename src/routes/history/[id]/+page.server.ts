import { db } from '$lib/server/db';
import type { Contest, Attempt, Standing } from '$lib/server/domain';
import { error } from '@sveltejs/kit';
export const load = async ({ params, locals }) => {
	const c = await db().collection<Contest>('contests').findOne({ _id: params.id, state: 'closed' });
	if (!c) error(404, 'Closed contest not found.');
	const result = await db()
		.collection<{ _id: string; standings: Standing[]; winnerIds: string[] }>('contestResults')
		.findOne({ _id: c._id });
	const won = !!locals.player && !!result?.winnerIds.includes(locals.player._id);
	const answers = locals.player
		? await db()
				.collection<Attempt>('attempts')
				.find({ contestId: c._id, playerId: locals.player._id })
				.sort({ startedAt: 1 })
				.toArray()
		: [];
	return {
		title: c.title,
		month: c.month,
		won,
		message: won
			? c.winnerMessage
					.replaceAll(
						'Show this screen to the owner to arrange your prize.',
						'Show this screen to the owner.'
					)
					.replaceAll('{nickname}', locals.player!.nickname)
					.replaceAll('{month}', c.month)
			: '',
		shared: (result?.winnerIds.length ?? 0) > 1,
		rows: result?.standings ?? [],
		answers: answers.map((a) => ({
			text: a.snapshot.text,
			submitted: a.answer === undefined ? 'No answer / time expired' : a.snapshot.options[a.answer],
			correct: a.snapshot.options[a.snapshot.correct],
			right: !!a.correct
		}))
	};
};
