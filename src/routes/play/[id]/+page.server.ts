import { db } from '$lib/server/db';
import { allowance, publicAttempt, type Attempt, type Contest } from '$lib/server/domain';
import { requirePlayer, failure, text } from '$lib/server/forms';
import { startQuestion, submitAnswer } from '$lib/server/contests';
import { error } from '@sveltejs/kit';
import { rateLimit, audit } from '$lib/server/identity';
import { RuleError } from '$lib/server/domain';
async function throttle(playerId: string) {
	try {
		await rateLimit(`play:${playerId}`, 120, 60000);
	} catch (err) {
		if (err instanceof RuleError && err.status === 429)
			await audit('play.excessive_requests', playerId);
		throw err;
	}
}
export const load = async (event) => {
	const p = requirePlayer(event);
	const c = await db().collection<Contest>('contests').findOne({ _id: event.params.id });
	if (!c || c.state === 'draft') error(404, 'Contest not found.');
	const active = await db()
		.collection<Attempt>('attempts')
		.findOne({ contestId: c._id, playerId: p._id, status: 'active' });
	const used = await db()
		.collection<Attempt>('attempts')
		.countDocuments({ contestId: c._id, playerId: p._id });
	return {
		contest: { id: c._id, title: c.title, state: c.state, seconds: c.seconds },
		active: active ? publicAttempt(active) : null,
		available: Math.max(0, allowance(c, new Date()) - used),
		used,
		serverNow: Date.now()
	};
};
export const actions = {
	start: async (e) => {
		const p = requirePlayer(e);
		try {
			await throttle(p._id);
			await startQuestion(e.params.id, p._id);
			return { recorded: false };
		} catch (err) {
			return failure(err);
		}
	},
	answer: async (e) => {
		const p = requirePlayer(e);
		const f = await e.request.formData();
		try {
			await throttle(p._id);
			const value = text(f, 'answer');
			await submitAnswer(
				e.params.id,
				p._id,
				text(f, 'attemptId'),
				value === '' ? null : Number(value)
			);
			return { recorded: true };
		} catch (err) {
			return failure(err);
		}
	}
};
