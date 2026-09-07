import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { db, mongo, indexes } from '../src/lib/server/db';
import { transaction } from '../src/lib/server/contests';
import { audit } from '../src/lib/server/identity';
const command = process.argv[2];
try {
	await indexes();
	if (command === 'indexes') console.log('Database indexes ready.');
	else if (command === 'create' || command === 'reset') {
		const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
		const password = process.env.ADMIN_PASSWORD;
		const name = process.env.ADMIN_NAME || 'Captain';
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12)
			throw new Error(
				'Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters); optionally ADMIN_NAME.'
			);
		const hash = await hashPassword(password);
		await transaction(async (session) => {
			await db()
				.collection<{ _id: string; revision: number }>('locks')
				.updateOne(
					{ _id: 'admin-directory' },
					{ $inc: { revision: 1 } },
					{ upsert: true, session }
				);
			// Better Auth's MongoDB adapter stores IDs and user references as native ObjectIds.
			const { ObjectId } = await import('mongodb');
			if (command === 'create') {
				if ((await db().collection('user').countDocuments({}, { session })) >= 2)
					throw new Error('The MVP supports two named administrators.');
				if (await db().collection('user').findOne({ email }, { session }))
					throw new Error('Administrator already exists.');
				const id = new ObjectId();
				const now = new Date();
				await db()
					.collection('user')
					.insertOne(
						{ _id: id, name, email, emailVerified: true, createdAt: now, updatedAt: now },
						{ session }
					);
				await db().collection('account').insertOne(
					{
						_id: new ObjectId(),
						userId: id,
						accountId: id.toHexString(),
						providerId: 'credential',
						password: hash,
						createdAt: now,
						updatedAt: now
					},
					{ session }
				);
			} else {
				const user = await db().collection('user').findOne({ email }, { session });
				if (!user) throw new Error('Administrator not found.');
				await db()
					.collection('account')
					.updateOne(
						{ userId: user._id, providerId: 'credential' },
						{ $set: { password: hash, updatedAt: new Date() } },
						{ session }
					);
				await db().collection('session').deleteMany({ userId: user._id }, { session });
			}
			await audit(`admin.${command}`, 'operator', { email, operationId: randomUUID() }, session);
		});
		console.log(`Administrator ${command} completed.`);
	} else throw new Error('Use indexes, create, or reset.');
} catch (e) {
	console.error(e instanceof Error ? e.message : 'Operation failed.');
	process.exitCode = 1;
} finally {
	await mongo().close();
}
