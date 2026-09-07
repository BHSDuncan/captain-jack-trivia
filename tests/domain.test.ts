import { describe, it, expect } from 'vitest';
import {
	allowance,
	period,
	ordered,
	rank,
	torontoDate,
	localDate,
	questionSchema,
	identitySchema,
	type Contest
} from '../src/lib/server/domain';
import { databaseName } from '../src/lib/server/db';
const start = torontoDate('2026-03-01T00:00');
describe('calendar allowances', () => {
	it('uses Toronto seven-day periods across spring DST', () => {
		expect(period(start, torontoDate('2026-02-28T23:59'))).toBe(0);
		expect(period(start, torontoDate('2026-03-07T23:59'))).toBe(1);
		expect(period(start, torontoDate('2026-03-08T00:00'))).toBe(2);
		expect(period(start, torontoDate('2026-03-15T00:00'))).toBe(3);
		expect(period(start, torontoDate('2026-03-31T23:59'))).toBe(5);
	});
	it('handles fall DST, short months, partial weeks and non-midnight starts', () => {
		expect(period(torontoDate('2026-10-28T18:00'), torontoDate('2026-11-04T17:59'))).toBe(1);
		expect(period(torontoDate('2026-10-28T18:00'), torontoDate('2026-11-04T18:00'))).toBe(2);
		expect(period(torontoDate('2026-02-01T00:00'), torontoDate('2026-02-28T23:59'))).toBe(4);
		expect(() => torontoDate('2026-03-08T02:30')).toThrow();
		expect(() => torontoDate('2026-11-01T01:30')).toThrow();
		expect(localDate(start)).toBe('2026-03-01T00:00');
	});
	it('carries unused allowance forward, caps at question count, independent of pauses', () => {
		const c = {
			startsAt: start,
			questionsPerWeek: 5,
			frozen: Array(18),
			state: 'paused'
		} as Contest;
		expect(allowance(c, torontoDate('2026-03-15T00:00'))).toBe(15);
		expect(allowance(c, torontoDate('2026-03-31T23:59'))).toBe(18);
	});
});
describe('fairness and validation', () => {
	it('creates reproducible permutations without mutating inputs', () => {
		const source = Array.from({ length: 30 }, (_, i) => i);
		expect(ordered(source, 'a')).toEqual(ordered(source, 'a'));
		expect(ordered(source, 'a')).not.toEqual(ordered(source, 'b'));
		expect(ordered(source, 'a').sort((a, b) => a - b)).toEqual(source);
	});
	it('ranks score before time and shares exact ties', () => {
		const rows = rank([
			{ playerId: '1', nickname: 'Anne', correct: 3, elapsedMs: 5000, attempted: 5 },
			{ playerId: '2', nickname: 'Ben', correct: 3, elapsedMs: 5000, attempted: 4 },
			{ playerId: '3', nickname: 'Cal', correct: 3, elapsedMs: 6000, attempted: 5 },
			{ playerId: '4', nickname: 'Dan', correct: 2, elapsedMs: 100, attempted: 2 }
		]);
		expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, 4]);
	});
	it('rejects invalid answers, unsafe text and invalid PINs', () => {
		expect(
			questionSchema.safeParse({ text: 'Question', options: ['A', 'A'], correct: 0, seconds: null })
				.success
		).toBe(false);
		expect(
			questionSchema.safeParse({ text: '<script>', options: ['A', 'B'], correct: 0, seconds: null })
				.success
		).toBe(false);
		expect(identitySchema.safeParse({ nickname: 'Anne', pin: 'abc123' }).success).toBe(false);
	});
	it('rejects cross-environment database configuration', () => {
		expect(databaseName({ MONGODB_DB: 'captain_jack_dev' })).toBe('captain_jack_dev');
		expect(() => databaseName({ MONGODB_DB: 'captain_jack_prod' })).toThrow();
		expect(() =>
			databaseName({ MONGODB_DB: 'captain_jack_dev', VERCEL_ENV: 'production' })
		).toThrow();
		expect(databaseName({ MONGODB_DB: 'captain_jack_prod', VERCEL_ENV: 'production' })).toBe(
			'captain_jack_prod'
		);
		expect(() =>
			databaseName({ MONGODB_DB: 'captain_jack_prod', VERCEL_ENV: 'preview' })
		).toThrow();
	});
});
