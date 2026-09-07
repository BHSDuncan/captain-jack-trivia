import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { db, mongo } from './db';
const makeAuth = () =>
	betterAuth({
		secret: process.env.BETTER_AUTH_SECRET!,
		baseURL: process.env.BETTER_AUTH_URL!,
		database: mongodbAdapter(db(), { client: mongo() }),
		emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
		session: { expiresIn: 8 * 3600, updateAge: 3600 },
		rateLimit: { enabled: true, storage: 'database', window: 60, max: 20 }
	});
let instance: ReturnType<typeof makeAuth> | undefined;
export function adminAuth() {
	if (
		!process.env.BETTER_AUTH_SECRET ||
		process.env.BETTER_AUTH_SECRET.length < 32 ||
		!process.env.BETTER_AUTH_URL
	)
		throw new Error('Configure administrator authentication secret and URL.');
	return (instance ??= makeAuth());
}
