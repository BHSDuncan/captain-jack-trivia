import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongodb';
import { db, mongo } from './db';
import { audit } from './identity';
import {
	allowance,
	contestSchema,
	questionSchema,
	ordered,
	period,
	rank,
	RuleError,
	type Attempt,
	type Contest,
	type ContestInput,
	type Player,
	type Question,
	type QuestionInput,
	type Standing
} from './domain';

const contests = () => db().collection<Contest>('contests');
const attempts = () => db().collection<Attempt>('attempts');
export async function transaction<T>(fn: (s: ClientSession) => Promise<T>): Promise<T> {
	const s = mongo().startSession();
	try {
		return (await s.withTransaction(() => fn(s)))!;
	} finally {
		await s.endSession();
	}
}
async function lock(id: string, s: ClientSession) {
	const c = await contests().findOneAndUpdate(
		{ _id: id },
		{ $inc: { revision: 1 } },
		{ session: s, returnDocument: 'after' }
	);
	if (!c) throw new RuleError('Contest not found.', 404);
	return c;
}
export async function standings(contestId: string, session?: ClientSession): Promise<Standing[]> {
	const rows = await attempts()
		.aggregate<{ _id: string; correct: number; elapsedMs: number; attempted: number }>(
			[
				{ $match: { contestId } },
				{
					$group: {
						_id: '$playerId',
						correct: { $sum: { $cond: ['$correct', 1, 0] } },
						elapsedMs: { $sum: { $cond: ['$correct', '$elapsedMs', 0] } },
						attempted: { $sum: 1 }
					}
				}
			],
			{ session }
		)
		.toArray();
	const players = await db()
		.collection<Player>('players')
		.find({ _id: { $in: rows.map((r) => r._id) } }, { session })
		.toArray();
	return rank(
		rows.map((r) => ({
			playerId: r._id,
			nickname: players.find((p) => p._id === r._id)?.nickname ?? 'Former player',
			correct: r.correct,
			elapsedMs: r.elapsedMs,
			attempted: r.attempted
		}))
	);
}
async function finalize(c: Contest, at: Date, s: ClientSession) {
	await attempts().updateMany(
		{ contestId: c._id, status: 'active' },
		{ $set: { status: 'timeout', correct: false, finishedAt: at } },
		{ session: s }
	);
	const rows = await standings(c._id, s);
	const winners = rows.filter((r) => r.rank === 1).map((r) => r.playerId);
	await db()
		.collection<{ _id: string; standings: Standing[]; winnerIds: string[]; finalizedAt: Date }>(
			'contestResults'
		)
		.replaceOne(
			{ _id: c._id },
			{ standings: rows, winnerIds: winners, finalizedAt: at },
			{ upsert: true, session: s }
		);
	await contests().updateOne(
		{ _id: c._id },
		{ $set: { state: 'closed', finalized: true, closedAt: at } },
		{ session: s }
	);
	await audit('contest.finalized', 'system', { contestId: c._id, winners }, s);
}
export async function reconcile() {
	const now = new Date();
	const due = await contests()
		.find({ state: { $in: ['scheduled', 'active', 'paused'] }, endsAt: { $lte: now } })
		.toArray();
	for (const c of due)
		await transaction(async (s) => {
			const current = await lock(c._id, s);
			if (current.state !== 'draft' && current.state !== 'closed' && current.endsAt <= new Date())
				await finalize(current, current.endsAt, s);
		});
	await contests().updateMany(
		{ state: 'scheduled', startsAt: { $lte: now }, endsAt: { $gt: now } },
		{ $set: { state: 'active' }, $inc: { revision: 1 } }
	);
}
export async function saveContest(input: ContestInput, id: string | undefined, actor: string) {
	const data = contestSchema.parse(input);
	return transaction(async (s) => {
		const key = id || randomUUID();
		if (id) {
			const c = await lock(id, s);
			if (c.state !== 'draft') throw new RuleError('Only draft contests can be edited.');
			await contests().updateOne({ _id: id }, { $set: data }, { session: s });
		} else
			await contests().insertOne(
				{ ...data, _id: key, state: 'draft', frozen: [], revision: 0 },
				{ session: s }
			);
		await audit('contest.saved', actor, { contestId: key }, s);
		return key;
	});
}
export async function saveQuestion(
	contestId: string,
	input: QuestionInput | null,
	id: string | undefined,
	actor: string
) {
	const data = input ? questionSchema.parse(input) : null;
	return transaction(async (s) => {
		const c = await lock(contestId, s);
		if (c.state !== 'draft') throw new RuleError('Published questions are frozen.');
		const key = id || randomUUID();
		if (!data)
			await db()
				.collection<Question>('questions')
				.deleteOne({ _id: key, contestId }, { session: s });
		else
			await db()
				.collection<Question>('questions')
				.replaceOne({ _id: key, contestId }, { ...data, contestId }, { upsert: true, session: s });
		await audit(
			data ? 'question.saved' : 'question.deleted',
			actor,
			{ contestId, questionId: key },
			s
		);
	});
}
export async function lifecycle(id: string, action: string, actor: string, newEnd?: Date) {
	await transaction(async (s) => {
		const c = await lock(id, s);
		const now = new Date();
		if (action === 'publish') {
			if (c.state !== 'draft' || c.endsAt <= now)
				throw new RuleError('Publish a draft whose end is in the future.');
			const questions = await db()
				.collection<Question>('questions')
				.find({ contestId: id }, { session: s })
				.sort({ _id: 1 })
				.toArray();
			if (!questions.length) throw new RuleError('Add at least one question.');
			questions.forEach((q) => questionSchema.parse(q));
			if (questions.length > period(c.startsAt, new Date(+c.endsAt - 1)) * c.questionsPerWeek)
				throw new RuleError('Weekly quota cannot unlock every question before closing.');
			// Serialize publication across contests, preventing overlapping live events.
			await db()
				.collection<{ _id: string; revision: number }>('locks')
				.updateOne({ _id: 'publication' }, { $inc: { revision: 1 } }, { upsert: true, session: s });
			const overlap = await contests().findOne(
				{
					_id: { $ne: id },
					state: { $in: ['scheduled', 'active', 'paused'] },
					startsAt: { $lt: c.endsAt },
					endsAt: { $gt: c.startsAt }
				},
				{ session: s }
			);
			if (overlap) throw new RuleError('Contest dates overlap another published contest.');
			await contests().updateOne(
				{ _id: id },
				{ $set: { frozen: questions, state: c.startsAt > now ? 'scheduled' : 'active' } },
				{ session: s }
			);
		} else if (action === 'draft') {
			if (c.state !== 'scheduled' || c.startsAt <= now)
				throw new RuleError('Only a future scheduled contest can return to draft.');
			await contests().updateOne(
				{ _id: id },
				{ $set: { state: 'draft', frozen: [] } },
				{ session: s }
			);
		} else if (action === 'pause' || action === 'resume') {
			if (c.state !== (action === 'pause' ? 'active' : 'paused') || c.endsAt <= now)
				throw new RuleError('Invalid contest transition.');
			await contests().updateOne(
				{ _id: id },
				{ $set: { state: action === 'pause' ? 'paused' : 'active' } },
				{ session: s }
			);
		} else if (action === 'close') {
			if (!['active', 'paused'].includes(c.state))
				throw new RuleError('Only an open contest can close early.');
			await finalize(c, now, s);
		} else if (action === 'reopen') {
			if (c.state !== 'closed' || !newEnd || newEnd <= now)
				throw new RuleError('Reopening requires a future closing time.');
			await db()
				.collection<{ _id: string; revision: number }>('locks')
				.updateOne({ _id: 'publication' }, { $inc: { revision: 1 } }, { upsert: true, session: s });
			const overlap = await contests().findOne(
				{
					_id: { $ne: id },
					state: { $in: ['scheduled', 'active', 'paused'] },
					startsAt: { $lt: newEnd },
					endsAt: { $gt: now }
				},
				{ session: s }
			);
			if (overlap) throw new RuleError('Reopening overlaps another contest.');
			await contests().updateOne(
				{ _id: id },
				{ $set: { state: 'active', endsAt: newEnd, finalized: false }, $unset: { closedAt: '' } },
				{ session: s }
			);
			await db()
				.collection<{ _id: string }>('contestResults')
				.deleteOne({ _id: id }, { session: s });
		} else throw new RuleError('Unknown action.');
		await audit(`contest.${action}`, actor, { contestId: id }, s);
	});
}
export async function startQuestion(contestId: string, playerId: string) {
	return transaction(async (s) => {
		const c = await lock(contestId, s);
		const now = new Date();
		if (c.state !== 'active' || now < c.startsAt || now >= c.endsAt)
			throw new RuleError('This contest is not open for play.');
		await attempts().updateMany(
			{ playerId, status: 'active', deadline: { $lte: now } },
			{ $set: { status: 'timeout', correct: false, finishedAt: now } },
			{ session: s }
		);
		const active = await attempts().findOne({ playerId, status: 'active' }, { session: s });
		if (active) {
			if (active.contestId !== contestId)
				throw new RuleError('Finish your current question first.');
			return active;
		}
		const used = await attempts().find({ playerId, contestId }, { session: s }).toArray();
		if (used.length >= allowance(c, now))
			throw new RuleError(
				'You have answered your available questions. Come back when the next allowance opens.'
			);
		const q = ordered(c.frozen, `${playerId}:${contestId}:questions`).find(
			(q) => !used.some((a) => a.questionId === q._id)
		);
		if (!q) throw new RuleError('All questions completed.');
		const a: Attempt = {
			_id: randomUUID(),
			contestId,
			playerId,
			questionId: q._id,
			snapshot: q,
			optionOrder: ordered(
				q.options.map((_, i) => i),
				`${playerId}:${q._id}:options`
			),
			startedAt: now,
			deadline: new Date(Math.min(+now + (q.seconds ?? c.seconds) * 1000, +c.endsAt)),
			status: 'active'
		};
		await attempts().insertOne(a, { session: s });
		return a;
	});
}
export async function submitAnswer(
	contestId: string,
	playerId: string,
	attemptId: string,
	answer: number | null
) {
	return transaction(async (s) => {
		const c = await lock(contestId, s);
		const now = new Date();
		if (c.state !== 'active' || now >= c.endsAt || now < c.startsAt)
			throw new RuleError('This contest is not open for answers.');
		const a = await attempts().findOne({ _id: attemptId, playerId, contestId }, { session: s });
		if (!a) throw new RuleError('Question not found.', 404);
		if (a.status !== 'active') return;
		if (answer !== null && (!Number.isInteger(answer) || !a.optionOrder.includes(answer)))
			throw new RuleError('Choose an available answer.');
		const expired = now >= a.deadline;
		if (answer === null && !expired) throw new RuleError('The timer has not expired.');
		await attempts().updateOne(
			{ _id: a._id, status: 'active' },
			{
				$set: {
					status: expired ? 'timeout' : 'answered',
					...(!expired ? { answer: answer! } : {}),
					correct: !expired && answer === a.snapshot.correct,
					elapsedMs: +now - +a.startedAt,
					finishedAt: now
				}
			},
			{ session: s }
		);
	});
}
