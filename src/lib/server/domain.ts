import { Temporal } from '@js-temporal/polyfill';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const plain = (min = 1, max = 200) =>
	z
		.string()
		.trim()
		.min(min)
		.max(max)
		.refine(
			(v) => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),
			'Use plain text without HTML.'
		);
export const identitySchema = z.object({
	nickname: plain(2, 24).regex(
		/^[\p{L}\p{N} _'-]+$/u,
		'Use letters, numbers, spaces, apostrophes or dashes.'
	),
	pin: z.string().regex(/^\d{6}$/, 'Use a six-digit PIN.')
});
export const questionSchema = z
	.object({
		text: plain(1, 1000),
		options: z.array(plain(1, 200)).min(2).max(6),
		correct: z.number().int().min(0),
		seconds: z.number().int().min(5).max(120).nullable()
	})
	.refine(
		(q) => q.correct < q.options.length && new Set(q.options).size === q.options.length,
		'Choose exactly one correct, distinct option.'
	);
export const contestSchema = z
	.object({
		month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
		title: plain(1, 100),
		prize: plain(1, 300),
		prizeValue: z.number().min(0).max(100000),
		startsAt: z.date(),
		endsAt: z.date(),
		questionsPerWeek: z.number().int().min(1).max(100),
		seconds: z.number().int().min(5).max(120),
		rules: plain(1, 5000),
		message: plain(0, 2000),
		winnerMessage: plain(1, 2000)
	})
	.refine((c) => c.endsAt > c.startsAt, 'End must follow start.');
export type QuestionInput = z.infer<typeof questionSchema>;
export type ContestInput = z.infer<typeof contestSchema>;
export type State = 'draft' | 'scheduled' | 'active' | 'paused' | 'closed';
export type Question = QuestionInput & { _id: string; contestId: string };
export type Contest = ContestInput & {
	_id: string;
	state: State;
	frozen: Question[];
	revision: number;
	finalized?: boolean;
	closedAt?: Date;
};
export type Player = {
	_id: string;
	nickname: string;
	nicknameKey: string;
	pinHash: string;
	createdAt: Date;
};
export type Attempt = {
	_id: string;
	contestId: string;
	playerId: string;
	questionId: string;
	snapshot: Question;
	optionOrder: number[];
	startedAt: Date;
	deadline: Date;
	status: 'active' | 'answered' | 'timeout';
	answer?: number;
	correct?: boolean;
	elapsedMs?: number;
	finishedAt?: Date;
};
export type Standing = {
	playerId: string;
	nickname: string;
	correct: number;
	elapsedMs: number;
	attempted: number;
	rank: number;
};
export class RuleError extends Error {
	constructor(
		message: string,
		public status = 400
	) {
		super(message);
	}
}
export function torontoDate(value: string) {
	try {
		return new Date(
			Temporal.PlainDateTime.from(value).toZonedDateTime('America/Toronto', {
				disambiguation: 'reject'
			}).epochMilliseconds
		);
	} catch {
		throw new RuleError(
			'Enter a valid Toronto date and time. Daylight-saving gaps and repeated times are not accepted.'
		);
	}
}
export function localDate(value: Date) {
	return Temporal.Instant.fromEpochMilliseconds(value.getTime())
		.toZonedDateTimeISO('America/Toronto')
		.toPlainDateTime()
		.toString({ smallestUnit: 'minute' });
}
export function period(start: Date, now: Date) {
	if (now < start) return 0;
	const s = Temporal.Instant.fromEpochMilliseconds(+start).toZonedDateTimeISO('America/Toronto');
	const n = Temporal.Instant.fromEpochMilliseconds(+now).toZonedDateTimeISO('America/Toronto');
	let p = Math.floor(s.toPlainDate().until(n.toPlainDate()).days / 7);
	if (Temporal.ZonedDateTime.compare(s.add({ days: p * 7 }), n) > 0) p--;
	return p + 1;
}
export function allowance(c: Contest, now: Date) {
	return Math.min(c.frozen.length, c.questionsPerWeek * period(c.startsAt, now));
}
export function ordered<T>(items: T[], seed: string): T[] {
	return items
		.map((item, i) => ({ item, hash: createHash('sha256').update(`${seed}:${i}`).digest('hex') }))
		.sort((a, b) => a.hash.localeCompare(b.hash))
		.map((x) => x.item);
}
export function rank(rows: Omit<Standing, 'rank'>[]): Standing[] {
	const sorted = [...rows].sort(
		(a, b) =>
			b.correct - a.correct || a.elapsedMs - b.elapsedMs || a.nickname.localeCompare(b.nickname)
	);
	return sorted.map((r, i) => ({
		...r,
		rank:
			i && r.correct === sorted[i - 1].correct && r.elapsedMs === sorted[i - 1].elapsedMs
				? sorted.findIndex((x) => x.correct === r.correct && x.elapsedMs === r.elapsedMs) + 1
				: i + 1
	}));
}
export function publicAttempt(a: Attempt) {
	return {
		id: a._id,
		text: a.snapshot.text,
		options: a.optionOrder.map((index) => ({ id: index, text: a.snapshot.options[index] })),
		deadline: a.deadline.toISOString()
	};
}
