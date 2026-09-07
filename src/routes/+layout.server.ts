export const load = ({ locals }: import('./$types').LayoutServerLoadEvent) => ({
	player: locals.player ? { nickname: locals.player.nickname } : null,
	admin: locals.admin ? { name: locals.admin.name } : null,
	barNetwork: locals.barNetwork
});
