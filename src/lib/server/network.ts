import { resolve4, resolve6 } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export function normalizeIP(raw: string | null) {
	if (!raw || raw.includes(',') || raw.includes('%')) return null;
	try {
		return ipaddr.process(raw.trim()).toNormalizedString();
	} catch {
		return null;
	}
}
type Lookup = (hostname: string) => Promise<string[]>;
const lookup: Lookup = async (host) => {
	const results = await Promise.allSettled([resolve4(host), resolve6(host)]);
	return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
};
export function networkGate(resolve: Lookup = lookup, clock = Date.now) {
	let cache: { host: string; until: number; addresses: string[] } | undefined;
	return async (headers: Headers, env = process.env) => {
		if (env.VERCEL_ENV !== 'production') return true;
		const host = env.BAR_DDNS_HOSTNAME;
		const ip = normalizeIP(headers.get('x-vercel-forwarded-for'));
		if (!host || !ip) return false;
		if (!cache || cache.host !== host || cache.until <= clock()) {
			try {
				cache = {
					host,
					until: clock() + 30000,
					addresses: (await resolve(host)).map(normalizeIP).filter((v): v is string => !!v)
				};
			} catch {
				cache = { host, until: clock() + 5000, addresses: [] };
			}
		}
		return cache.addresses.includes(ip);
	};
}
export const onBarNetwork = networkGate();
