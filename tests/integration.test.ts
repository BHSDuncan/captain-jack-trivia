import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Cookies } from '@sveltejs/kit';
import { db, mongo, indexes } from '../src/lib/server/db';
import {
	saveContest,
	saveQuestion,
	lifecycle,
	startQuestion,
	submitAnswer,
	standings,
	reconcile
} from '../src/lib/server/contests';
import {
	authenticatePlayer,
	playerFromCookies,
	rateLimit,
	hashPin,
	verifyPin,
	digest
} from '../src/lib/server/identity';
import {
	publicAttempt,
	type ContestInput,
	type Contest,
	type Attempt,
	type Player,
	type Standing
} from '../src/lib/server/domain';
import { adminAuth } from '../src/lib/server/auth';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
let server: MongoMemoryReplSet;
function jar(): Cookies {
	const values = new Map<string, string>();
	return {
		get: (k) => values.get(k),
		set: (k, v) => {
			values.set(k, v);
		},
		delete: (k) => {
			values.delete(k);
		},
		getAll: () => [...values].map(([name, value]) => ({ name, value })),
		serialize: () => ''
	} as Cookies;
}
const template = (): ContestInput => ({
	month: '2026-09',
	title: 'September',
	prize: 'Merchandise',
	prizeValue: 50,
	startsAt: new Date(Date.now() - 1000),
	endsAt: new Date(Date.now() + 86400000),
	questionsPerWeek: 5,
	seconds: 20,
	rules: 'No searching.',
	message: 'Welcome',
	winnerMessage: 'Well done {nickname} in {month}!'
});
async function contest(count = 2) {
	const id = await saveContest(template(), undefined, 'admin');
	for (let i = 0; i < count; i++)
		await saveQuestion(
			id,
			{ text: `Question ${i}`, options: ['Yes', 'No'], correct: 0, seconds: null },
			undefined,
			'admin'
		);
	await lifecycle(id, 'publish', 'admin');
	return id;
}
async function player(name = 'Anne') {
	const cookies = jar();
	const p = await authenticatePlayer(
		{ nickname: name, pin: '123456' },
		'register',
		cookies,
		'local'
	);
	return { p, cookies };
}
beforeAll(async () => {
	server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
	process.env.MONGODB_URI = server.getUri();
	process.env.MONGODB_DB = 'captain_jack_test';
	process.env.BETTER_AUTH_SECRET = 'a-test-secret-that-is-longer-than-thirty-two-characters';
	process.env.BETTER_AUTH_URL = 'http://localhost:5173';
	await indexes();
});
beforeEach(async () => {
	for (const c of await db().collections()) await c.deleteMany({});
});
afterAll(async () => {
	await mongo().close();
	await server?.stop();
});
describe('real MongoDB contest operations', () => {
	it('serializes duplicate tabs, hides answers and records one immutable answer', async () => {
		const id = await contest();
		const { p } = await player();
		const [a, b] = await Promise.all([startQuestion(id, p._id), startQuestion(id, p._id)]);
		expect(a._id).toBe(b._id);
		expect(publicAttempt(a)).not.toHaveProperty('snapshot');
		expect(JSON.stringify(publicAttempt(a))).not.toContain('correct');
		await Promise.all([submitAnswer(id, p._id, a._id, 0), submitAnswer(id, p._id, a._id, 0)]);
		expect((await standings(id))[0].correct).toBe(1);
		await submitAnswer(id, p._id, a._id, 1);
		expect((await standings(id))[0].correct).toBe(1);
		const next = await startQuestion(id, p._id);
		expect(next.questionId).not.toBe(a.questionId);
	});
	it('enforces expiration, pause, resume and quota without resetting the timer', async () => {
		const id = await contest(1);
		const { p } = await player();
		const a = await startQuestion(id, p._id);
		await lifecycle(id, 'pause', 'admin');
		await expect(submitAnswer(id, p._id, a._id, 0)).rejects.toThrow('not open');
		await lifecycle(id, 'resume', 'admin');
		expect((await startQuestion(id, p._id)).deadline).toEqual(a.deadline);
		await db()
			.collection<Attempt>('attempts')
			.updateOne({ _id: a._id }, { $set: { deadline: new Date(Date.now() - 1) } });
		await submitAnswer(id, p._id, a._id, 0);
		expect((await standings(id))[0].correct).toBe(0);
		await expect(startQuestion(id, p._id)).rejects.toThrow('available');
	});
	it('freezes published content, validates publishing and audits changes', async () => {
		const id = await contest();
		await expect(saveContest(template(), id, 'admin')).rejects.toThrow('draft');
		await expect(
			saveQuestion(
				id,
				{ text: 'Changed', options: ['A', 'B'], correct: 1, seconds: null },
				undefined,
				'admin'
			)
		).rejects.toThrow('frozen');
		expect(await db().collection('auditEvents').countDocuments({ action: 'contest.publish' })).toBe(
			1
		);
		await lifecycle(id, 'close', 'admin');
		const input = template();
		input.month = '2026-10';
		input.questionsPerWeek = 1;
		const other = await saveContest(input, undefined, 'admin');
		await expect(lifecycle(other, 'publish', 'admin')).rejects.toThrow('at least');
		for (let i = 0; i < 2; i++)
			await saveQuestion(
				other,
				{ text: `Q${i}`, options: ['A', 'B'], correct: 0, seconds: null },
				undefined,
				'admin'
			);
		await expect(lifecycle(other, 'publish', 'admin')).rejects.toThrow('quota');
	});
	it('self-heals missed close and finalizes joint winners once, then clears on reopen', async () => {
		const id = await contest(1);
		for (const name of ['Anne', 'Ben']) {
			const { p } = await player(name);
			const a = await startQuestion(id, p._id);
			await submitAnswer(id, p._id, a._id, 0);
			await db()
				.collection<Attempt>('attempts')
				.updateOne({ _id: a._id }, { $set: { elapsedMs: 5000 } });
		}
		await db()
			.collection<Contest>('contests')
			.updateOne({ _id: id }, { $set: { endsAt: new Date(Date.now() - 1) } });
		await Promise.all([reconcile(), reconcile()]);
		const result = await db()
			.collection<{ _id: string; winnerIds: string[]; standings: Standing[] }>('contestResults')
			.findOne({ _id: id });
		expect(result?.winnerIds).toHaveLength(2);
		expect(result?.standings.map((r) => r.rank)).toEqual([1, 1]);
		expect(
			await db().collection('auditEvents').countDocuments({ action: 'contest.finalized' })
		).toBe(1);
		await lifecycle(id, 'reopen', 'admin', new Date(Date.now() + 86400000));
		expect(await db().collection('contestResults').countDocuments()).toBe(0);
		await lifecycle(id, 'close', 'admin');
		expect(await db().collection('contestResults').countDocuments()).toBe(1);
	});
	it('rejects foreign players and malformed answer ids', async () => {
		const id = await contest();
		const { p } = await player();
		const { p: other } = await player('Ben');
		const a = await startQuestion(id, p._id);
		await expect(submitAnswer(id, other._id, a._id, 0)).rejects.toThrow('not found');
		await expect(submitAnswer(id, p._id, a._id, 99)).rejects.toThrow('available answer');
		await expect(submitAnswer(id, p._id, a._id, null)).rejects.toThrow('not expired');
	});
	it('applies the same tie rule to zero scores', async () => {
		const id = await contest();
		const { p } = await player();
		const { p: second } = await player('Ben');
		await startQuestion(id, p._id);
		await startQuestion(id, second._id);
		await lifecycle(id, 'close', 'admin');
		expect((await db().collection('contestResults').findOne({}))?.winnerIds.sort()).toEqual(
			[p._id, second._id].sort()
		);
	});
	it('records no winner when nobody participates', async () => {
		const id = await contest();
		await lifecycle(id, 'close', 'admin');
		expect((await db().collection('contestResults').findOne({}))?.winnerIds).toEqual([]);
	});
});
describe('identities and administrator authentication', () => {
	it('binds a device, enforces nickname uniqueness and expires sessions on reads', async () => {
		const { p, cookies } = await player();
		expect((await playerFromCookies(cookies))?._id).toBe(p._id);
		await expect(
			authenticatePlayer({ nickname: 'Another', pin: '123456' }, 'register', cookies, 'local')
		).rejects.toThrow('already');
		await expect(
			authenticatePlayer({ nickname: 'ANNE', pin: '123456' }, 'register', jar(), 'local')
		).rejects.toThrow('already');
		const another = jar();
		expect(
			(await authenticatePlayer({ nickname: 'anne', pin: '123456' }, 'login', another, 'local'))._id
		).toBe(p._id);
		expect(
			await db().collection('auditEvents').countDocuments({ action: 'identity.new_device' })
		).toBe(1);
		await db()
			.collection('playerSessions')
			.updateMany({}, { $set: { expiresAt: new Date(0) } });
		expect(await playerFromCookies(cookies)).toBe(null);
	});
	it('hashes PINs with salts and enforces persistent rate limits', async () => {
		const a = await hashPin('123456'),
			b = await hashPin('123456');
		expect(a).not.toBe(b);
		expect(await verifyPin('123456', a)).toBe(true);
		expect(await verifyPin('654321', a)).toBe(false);
		await rateLimit('test', 2);
		await rateLimit('test', 2);
		await expect(rateLimit('test', 2)).rejects.toThrow('Too many');
	});
	it('boots a real Better Auth admin, rejects public signup and invalidates sessions on operator reset', async () => {
		const env = {
			...process.env,
			ADMIN_EMAIL: 'owner@example.org',
			ADMIN_PASSWORD: 'A-long-test-password-123!',
			ADMIN_NAME: 'Owner'
		};
		await exec(process.execPath, ['--import', 'tsx', 'scripts/operator.ts', 'create'], { env });
		const auth = adminAuth();
		const response = await auth.api.signInEmail({
			body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
			asResponse: true
		});
		expect(response.status).toBe(200);
		const cookie = response.headers
			.getSetCookie()
			.map((v) => v.split(';')[0])
			.join('; ');
		expect((await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.email).toBe(
			env.ADMIN_EMAIL
		);
		const signup = await auth.handler(
			new Request('http://localhost:5173/api/auth/sign-up/email', {
				method: 'POST',
				headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
				body: JSON.stringify({
					name: 'Intruder',
					email: 'intruder@example.org',
					password: 'Another-long-password'
				})
			})
		);
		expect(signup.status).toBeGreaterThanOrEqual(400);
		await exec(process.execPath, ['--import', 'tsx', 'scripts/operator.ts', 'reset'], {
			env: { ...env, ADMIN_PASSWORD: 'A-new-long-test-password-123!' }
		});
		expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBe(null);
		expect(await db().collection('user').countDocuments()).toBe(1);
	});
});
