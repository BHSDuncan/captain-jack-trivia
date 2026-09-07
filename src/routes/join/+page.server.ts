import { redirect, fail } from '@sveltejs/kit';
import { authenticatePlayer, digest } from '$lib/server/identity';
import { db } from '$lib/server/db';
import { failure, text } from '$lib/server/forms';
import { startQuestion } from '$lib/server/contests';
import { RuleError, type Contest, type Player } from '$lib/server/domain';
export const actions = {
	enter: async (event) => {
		if (!event.locals.barNetwork) return fail(403, { error: 'Join Captain Jack’s Wi-Fi to play.' });
		const f = await event.request.formData();
		const mode = text(f, 'mode');
		let player: Player;
		try {
			if (mode !== 'register' && mode !== 'login')
				return { error: 'Choose registration or sign in.' };
			player = await authenticatePlayer(
				{ nickname: text(f, 'nickname'), pin: text(f, 'pin') },
				mode,
				event.cookies,
				event.request.headers.get('x-vercel-forwarded-for') || 'local'
			);
		} catch (e) {
			return failure(e);
		}
		const contest = await db()
			.collection<Contest>('contests')
			.findOne({ state: { $in: ['active', 'paused'] } }, { sort: { startsAt: -1 } });
		if (contest) {
			try {
				// Issue or resume the question in this POST, never as a side effect of a page load.
				await startQuestion(contest._id, player._id);
			} catch (e) {
				// The play page explains exhausted allowance, pauses, or a concurrent close.
				if (!(e instanceof RuleError)) throw e;
			}
			redirect(303, `/play/${contest._id}`);
		}
		redirect(303, '/');
	},
	logout: async ({ cookies }) => {
		const token = cookies.get('cj_session');
		if (token)
			await db()
				.collection<{ _id: string }>('playerSessions')
				.deleteOne({ _id: digest(token) });
		cookies.delete('cj_session', { path: '/' });
		redirect(303, '/');
	}
};
