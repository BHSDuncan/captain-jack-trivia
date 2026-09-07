import { db } from '$lib/server/db';
import { type Contest, type Question, localDate, torontoDate } from '$lib/server/domain';
import { requireAdmin, text, failure } from '$lib/server/forms';
import { saveContest, saveQuestion, lifecycle, standings, transaction } from '$lib/server/contests';
import { audit } from '$lib/server/identity';
import { plain } from '$lib/server/domain';
import { error, redirect } from '@sveltejs/kit';
export const load = async (e) => {
	requireAdmin(e);
	const c =
		e.params.id === 'new'
			? null
			: await db().collection<Contest>('contests').findOne({ _id: e.params.id });
	if (e.params.id !== 'new' && !c) error(404, 'Contest not found.');
	const questions = c
		? await db()
				.collection<Question>('questions')
				.find({ contestId: c._id })
				.sort({ _id: 1 })
				.toArray()
		: [];
	return {
		contest: c
			? {
					...c,
					startsAt: localDate(c.startsAt),
					endsAt: localDate(c.endsAt),
					closedAt: c.closedAt?.toISOString()
				}
			: null,
		questions,
		rows: c ? await standings(c._id) : []
	};
};
export const actions = {
	save: async (e) => {
		const actor = requireAdmin(e).id;
		const f = await e.request.formData();
		let id: string;
		try {
			id = await saveContest(
				{
					month: text(f, 'month'),
					title: text(f, 'title'),
					prize: text(f, 'prize'),
					prizeValue: Number(text(f, 'prizeValue')),
					startsAt: torontoDate(text(f, 'startsAt')),
					endsAt: torontoDate(text(f, 'endsAt')),
					questionsPerWeek: Number(text(f, 'questionsPerWeek')),
					seconds: Number(text(f, 'seconds')),
					rules: text(f, 'rules'),
					message: text(f, 'message'),
					winnerMessage: text(f, 'winnerMessage')
				},
				e.params.id === 'new' ? undefined : e.params.id,
				actor
			);
		} catch (err) {
			return failure(err);
		}
		redirect(303, `/admin/contests/${id}`);
	},
	question: async (e) => {
		const actor = requireAdmin(e).id;
		const f = await e.request.formData();
		try {
			const options = f.getAll('option').map(String);
			const nonempty = options.map((v, i) => ({ v: v.trim(), i })).filter((x) => x.v);
			const original = Number(text(f, 'correct'));
			await saveQuestion(
				e.params.id,
				text(f, 'delete') === 'yes'
					? null
					: {
							text: text(f, 'text'),
							options: nonempty.map((x) => x.v),
							correct: nonempty.findIndex((x) => x.i === original),
							seconds: text(f, 'seconds') ? Number(text(f, 'seconds')) : null
						},
				text(f, 'questionId') || undefined,
				actor
			);
			return { success: 'Question saved.' };
		} catch (err) {
			return failure(err);
		}
	},
	lifecycle: async (e) => {
		const actor = requireAdmin(e).id;
		const f = await e.request.formData();
		try {
			if (text(f, 'confirm') !== 'yes') return { error: 'Confirm this contest change first.' };
			await lifecycle(
				e.params.id,
				text(f, 'action'),
				actor,
				text(f, 'newEnd') ? torontoDate(text(f, 'newEnd')) : undefined
			);
			return { success: 'Contest updated.' };
		} catch (err) {
			return failure(err);
		}
	},
	messages: async (e) => {
		const actor = requireAdmin(e).id;
		const f = await e.request.formData();
		try {
			const message = plain(0, 2000).parse(text(f, 'message'));
			const winnerMessage = plain(1, 2000).parse(text(f, 'winnerMessage'));
			await transaction(async (s) => {
				await db()
					.collection<Contest>('contests')
					.updateOne(
						{ _id: e.params.id },
						{ $set: { message, winnerMessage }, $inc: { revision: 1 } },
						{ session: s }
					);
				await audit('contest.messages', actor, { contestId: e.params.id }, s);
			});
			return { success: 'Messages updated.' };
		} catch (err) {
			return failure(err);
		}
	}
};
