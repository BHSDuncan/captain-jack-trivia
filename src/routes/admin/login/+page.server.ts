import { adminAuth } from '$lib/server/auth';
import { text } from '$lib/server/forms';
import { redirect } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/identity';
export const actions = {
	default: async ({ request, cookies }) => {
		const f = await request.formData();
		try {
			await rateLimit(`admin-login:${text(f, 'email').toLowerCase()}`, 10);
			await rateLimit(
				`admin-source:${request.headers.get('x-vercel-forwarded-for') || 'local'}`,
				50
			);
			const response = await adminAuth().api.signInEmail({
				body: { email: text(f, 'email'), password: text(f, 'password') },
				headers: request.headers,
				asResponse: true
			});
			if (!response.ok)
				return { error: 'Unable to sign in. Check your details or try again later.' };
			// Preserve Better Auth's cookie attributes when forwarding its server API response.
			const { parseSetCookieHeader } = await import('better-auth/cookies');
			for (const raw of response.headers.getSetCookie()) {
				for (const [name, cookie] of parseSetCookieHeader(raw))
					cookies.set(name, cookie.value, {
						path: cookie.path || '/',
						httpOnly: cookie.httponly,
						secure: cookie.secure,
						sameSite: cookie.samesite as 'lax' | 'strict' | 'none' | undefined,
						maxAge: cookie['max-age'],
						expires: cookie.expires
					});
			}
		} catch {
			return { error: 'Unable to sign in. Check your details or try again later.' };
		}
		redirect(303, '/admin');
	}
};
