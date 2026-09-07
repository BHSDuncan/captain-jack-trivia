import { MongoClient } from 'mongodb';
let client: MongoClient | undefined;
export function databaseName(env = process.env) {
	const name = env.MONGODB_DB;
	if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Configure MONGODB_DB.');
	const prod = env.PRODUCTION_DB || 'captain_jack_prod';
	if ((env.VERCEL_ENV === 'production') !== (name === prod))
		throw new Error('Database environment mismatch.');
	return name;
}
export function mongo() {
	if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI.');
	return (client ??= new MongoClient(process.env.MONGODB_URI, {
		maxPoolSize: 10,
		serverSelectionTimeoutMS: 5000
	}));
}
export function db() {
	return mongo().db(databaseName());
}
export async function indexes() {
	const d = db();
	await Promise.all([
		d.collection('user').createIndex({ email: 1 }, { unique: true }),
		d.collection('account').createIndex({ providerId: 1, accountId: 1 }, { unique: true }),
		d.collection('session').createIndex({ token: 1 }, { unique: true }),
		d.collection('session').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
		d.collection('players').createIndex({ nicknameKey: 1 }, { unique: true }),
		d.collection('playerSessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
		d.collection('devices').createIndex({ tokenHash: 1 }, { unique: true }),
		d
			.collection('attempts')
			.createIndex({ playerId: 1, contestId: 1, questionId: 1 }, { unique: true }),
		d
			.collection('attempts')
			.createIndex(
				{ playerId: 1 },
				{ unique: true, partialFilterExpression: { status: 'active' } }
			),
		d.collection('attempts').createIndex({ contestId: 1, playerId: 1, correct: 1 }),
		d.collection('questions').createIndex({ contestId: 1 }),
		d.collection('contests').createIndex({ month: 1 }, { unique: true }),
		d.collection('contests').createIndex({ state: 1, endsAt: 1 }),
		d.collection('auditEvents').createIndex({ at: -1 }),
		d.collection('rateLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
	]);
}
