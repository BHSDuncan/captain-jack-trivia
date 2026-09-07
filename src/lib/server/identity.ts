import {
	randomBytes,
	randomUUID,
	createHash,
	scrypt as rawScrypt,
	timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies } from '@sveltejs/kit';
import type { ClientSession } from 'mongodb';
import { db, mongo } from './db';
import { identitySchema, RuleError, type Player } from './domain';
const scrypt = promisify(rawScrypt);
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export async function hashPin(pin: string) {
	const salt = randomBytes(16).toString('hex');
	return `${salt}:${((await scrypt(pin, salt, 64)) as Buffer).toString('hex')}`;
}
export async function verifyPin(pin: string, stored: string) {
	const [salt, hash] = stored.split(':');
	const actual = (await scrypt(pin, salt, 64)) as Buffer;
	const expected = Buffer.from(hash, 'hex');
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function rateLimit(key: string, limit = 10, windowMs = 15 * 60000) {
	const bucket = Math.floor(Date.now() / windowMs);
	const record = await db()
		.collection<{ _id: string; count: number; expiresAt: Date }>('rateLimits')
		.findOneAndUpdate(
			{ _id: digest(`${key}:${bucket}`) },
			{ $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) } },
			{ upsert: true, returnDocument: 'after' }
		);
	if (record!.count > limit) throw new RuleError('Too many attempts. Please try again later.', 429);
}
export async function audit(
	action: string,
	actor: string,
	detail: Record<string, unknown> = {},
	session?: ClientSession
) {
	await db()
		.collection('auditEvents')
		.insertOne({ at: new Date(), action, actor, detail }, { session });
}
const cookieOpts = {
	path: '/',
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const
};
export async function playerFromCookies(cookies: Cookies) {
	const token = cookies.get('cj_session');
	if (!token) return null;
	const session = await db()
		.collection<{ _id: string; playerId: string; expiresAt: Date }>('playerSessions')
		.findOne({ _id: digest(token), expiresAt: { $gt: new Date() } });
	return session ? db().collection<Player>('players').findOne({ _id: session.playerId }) : null;
}
export async function authenticatePlayer(
	input: unknown,
	mode: 'register' | 'login',
	cookies: Cookies,
	source: string
) {
	const data = identitySchema.parse(input);
	const nicknameKey = data.nickname.toLocaleLowerCase('en-CA');
	await rateLimit(`identity:account:${nicknameKey}`);
	// The whole bar shares an IP; device/account limits are deliberately tighter.
	await rateLimit(`identity:source:${source}`, 250);
	let device = cookies.get('cj_device');
	if (!device || !/^[a-f0-9]{64}$/.test(device)) device = randomBytes(32).toString('hex');
	cookies.set('cj_device', device, { ...cookieOpts, maxAge: 365 * 86400 });
	await rateLimit(`identity:device:${digest(device)}`, 15);
	let player: Player | null;
	if (mode === 'register') {
		const candidate: Player = {
			_id: randomUUID(),
			nickname: data.nickname,
			nicknameKey,
			pinHash: await hashPin(data.pin),
			createdAt: new Date()
		};
		const session = mongo().startSession();
		try {
			await session.withTransaction(async () => {
				const existing = await db()
					.collection('devices')
					.findOne({ tokenHash: digest(device!) }, { session });
				if (existing) throw new RuleError('This browser already has a player. Please sign in.');
				await db().collection<Player>('players').insertOne(candidate, { session });
				await db()
					.collection('devices')
					.insertOne(
						{ tokenHash: digest(device!), playerId: candidate._id, createdAt: new Date() },
						{ session }
					);
			});
		} catch (e) {
			if ((e as { code?: number }).code === 11000)
				throw new RuleError(
					'Nickname or device already registered. Please sign in or choose another nickname.'
				);
			throw e;
		} finally {
			await session.endSession();
		}
		player = candidate;
	} else {
		player = await db().collection<Player>('players').findOne({ nicknameKey });
		if (
			!(await verifyPin(
				data.pin,
				player?.pinHash ?? '00000000000000000000000000000000:' + '00'.repeat(64)
			)) ||
			!player
		) {
			await audit('identity.failed', 'anonymous', {
				account: digest(nicknameKey),
				device: digest(device)
			});
			throw new RuleError('Nickname or PIN is incorrect.');
		}
		const bound = await db()
			.collection('devices')
			.findOne({ tokenHash: digest(device) });
		if (bound && bound.playerId !== player._id)
			await audit('identity.shared_device', player._id, { otherPlayer: bound.playerId });
		if (!bound) {
			await db()
				.collection('devices')
				.updateOne(
					{ tokenHash: digest(device) },
					{ $setOnInsert: { playerId: player._id, createdAt: new Date() } },
					{ upsert: true }
				);
			await audit('identity.new_device', player._id);
		}
	}
	const token = randomBytes(32).toString('hex');
	await db()
		.collection<{ _id: string; playerId: string; expiresAt: Date }>('playerSessions')
		.insertOne({
			_id: digest(token),
			playerId: player._id,
			expiresAt: new Date(Date.now() + 30 * 86400000)
		});
	cookies.set('cj_session', token, { ...cookieOpts, maxAge: 30 * 86400 });
	return player;
}
