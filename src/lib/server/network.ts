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
export type NetworkDiagnostic = {
	checkedAt: string;
	clientIp: string | null;
	addresses: string[];
	dnsSource: 'not checked' | 'cached' | 'lookup';
	dnsAgeMs: number | null;
	reason: string;
	allowed: boolean;
};
const lookup: Lookup = async (host) => {
	const results = await Promise.allSettled([resolve4(host), resolve6(host)]);
	return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
};
export function networkGate(resolve: Lookup = lookup, clock = Date.now) {
	let cache: { host: string; until: number; fetchedAt: number; addresses: string[] } | undefined;
	return async (headers: Headers, env = process.env, report?: (value: NetworkDiagnostic) => void) => {
		const diagnostic: NetworkDiagnostic = {
			checkedAt: new Date(clock()).toISOString(), clientIp: normalizeIP(headers.get('x-vercel-forwarded-for')),
			addresses: [], dnsSource: 'not checked', dnsAgeMs: null, reason: '', allowed: false
		};
		const finish = (allowed: boolean, reason: string) => {
			report?.({ ...diagnostic, allowed, reason });
			return allowed;
		};
		if (env.VERCEL_ENV !== 'production') return finish(true, 'Wi-Fi gate bypassed outside production');
		const host = env.BAR_DDNS_HOSTNAME;
		const ip = normalizeIP(headers.get('x-vercel-forwarded-for'));
		if (!host) return finish(false, 'Bar DNS hostname is not configured');
		if (!ip) return finish(false, 'Protected client-IP header is missing or invalid');
		diagnostic.dnsSource = 'cached';
		if (!cache || cache.host !== host || cache.until <= clock()) {
			diagnostic.dnsSource = 'lookup';
			try {
				cache = {
					host,
					fetchedAt: clock(),
					until: clock() + 30000,
					addresses: (await resolve(host)).map(normalizeIP).filter((v): v is string => !!v)
				};
			} catch {
				cache = { host, fetchedAt: clock(), until: clock() + 5000, addresses: [] };
			}
		}
		diagnostic.addresses = [...cache.addresses];
		diagnostic.dnsAgeMs = Math.max(0, clock() - cache.fetchedAt);
		return finish(cache.addresses.includes(ip), !cache.addresses.length
			? 'DNS lookup returned no usable addresses (empty result or lookup failure)'
			: cache.addresses.includes(ip) ? 'Client IP matches a bar DNS address' : 'Client IP does not match any bar DNS address');
	};
}
export const onBarNetwork = networkGate();
