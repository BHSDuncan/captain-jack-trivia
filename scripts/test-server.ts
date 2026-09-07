import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { db, indexes, mongo } from '../src/lib/server/db';
import { saveContest, saveQuestion, lifecycle } from '../src/lib/server/contests';
import { startQuestion, submitAnswer } from '../src/lib/server/contests';
import { hashPin } from '../src/lib/server/identity';
import type { Attempt, Player } from '../src/lib/server/domain';
const production = process.env.E2E_PRODUCTION === 'true';
const port = production ? 5174 : 5173;
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replica.getUri();
process.env.MONGODB_DB = production ? 'captain_jack_e2e_prod' : 'captain_jack_e2e_dev';
process.env.PRODUCTION_DB = 'captain_jack_e2e_prod';
process.env.VERCEL_ENV = production ? 'production' : 'preview';
process.env.BAR_DDNS_HOSTNAME = 'localhost';
process.env.BETTER_AUTH_SECRET = 'local-test-secret-at-least-thirty-two-characters';
process.env.BETTER_AUTH_URL = `http://127.0.0.1:${port}`;
process.env.CRON_SECRET = 'local-test-cron-secret';
await indexes();
const archived = await saveContest(
	{
		month: '2026-08',
		title: 'The August Voyage',
		prize: 'Shared merchandise prize',
		prizeValue: 50,
		startsAt: new Date(Date.now() - 3600000),
		endsAt: new Date(Date.now() + 60000),
		questionsPerWeek: 5,
		seconds: 20,
		rules: 'Exact ties result in joint winners.',
		message: '',
		winnerMessage:
			'Well done, {nickname}. You are a winner for {month}. Show the owner this screen.'
	},
	undefined,
	'fixture'
);
await saveQuestion(
	archived,
	{
		text: 'A ship is at sea. Where is it?',
		options: ['At sea', 'In the mountains'],
		correct: 0,
		seconds: null
	},
	undefined,
	'fixture'
);
await lifecycle(archived, 'publish', 'fixture');
for (const nickname of ['Anne Read', 'Ben Read']) {
	const playerId = nickname.replace(' ', '-');
	await db()
		.collection<Player>('players')
		.insertOne({
			_id: playerId,
			nickname,
			nicknameKey: nickname.toLowerCase(),
			pinHash: await hashPin('123456'),
			createdAt: new Date()
		});
	const attempt = await startQuestion(archived, playerId);
	await submitAnswer(archived, playerId, attempt._id, 0);
	await db()
		.collection<Attempt>('attempts')
		.updateOne({ _id: attempt._id }, { $set: { elapsedMs: 1500 } });
}
await lifecycle(archived, 'close', 'fixture');
await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/operator.ts', 'create'], {
	env: {
		...process.env,
		ADMIN_EMAIL: 'owner@example.org',
		ADMIN_NAME: 'Owner',
		ADMIN_PASSWORD: 'Captain-test-password-123!'
	}
});
const id = await saveContest(
	{
		month: '2026-09',
		title: 'The September Voyage',
		prize: 'Captain Jack merchandise',
		prizeValue: 50,
		startsAt: new Date(Date.now() - 3600000),
		endsAt: new Date(Date.now() + 86400000),
		questionsPerWeek: 5,
		seconds: 20,
		rules: 'One player per person. No outside research. Exact ties result in joint winners.',
		message: 'Your weekly dose of curiosity.',
		winnerMessage: 'Congratulations, {nickname}! You won {month}. Show this screen to Captain Jack.'
	},
	undefined,
	'fixture'
);
await saveQuestion(
	id,
	{
		text: 'Which ocean borders Canada to the east?',
		options: ['Atlantic', 'Pacific', 'Indian'],
		correct: 0,
		seconds: 20
	},
	undefined,
	'fixture'
);
await saveQuestion(
	id,
	{
		text: 'How many sides does a triangle have?',
		options: ['Three', 'Four', 'Five'],
		correct: 0,
		seconds: 5
	},
	undefined,
	'fixture'
);
await lifecycle(id, 'publish', 'fixture');
const child = spawn(
	process.execPath,
	['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
	{ stdio: 'inherit', env: process.env }
);
let stopping = false;
async function stop() {
	if (stopping) return;
	stopping = true;
	child.kill('SIGTERM');
	await mongo().close();
	await replica.stop();
	process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', stop);
