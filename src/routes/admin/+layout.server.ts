import { requireAdmin } from '$lib/server/forms';
export const load = (event) => {
	if (event.url.pathname !== '/admin/login') requireAdmin(event);
	return {};
};
