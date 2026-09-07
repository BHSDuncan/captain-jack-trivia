import { describe, it, expect } from 'vitest';
import { networkGate, normalizeIP } from '../src/lib/server/network';
const env = { VERCEL_ENV: 'production', BAR_DDNS_HOSTNAME: 'bar.example.org' };
const headers = (ip: string) => new Headers({ 'x-vercel-forwarded-for': ip });
describe('bar network enforcement', () => {
	it('accepts normalized IPv4, mapped IPv4 and IPv6', async () => {
		const gate = networkGate(async () => ['192.0.2.4', '2001:db8::4']);
		expect(await gate(headers('192.0.2.4'), env)).toBe(true);
		expect(await gate(headers('::ffff:192.0.2.4'), env)).toBe(true);
		expect(await gate(headers('2001:0db8:0:0:0:0:0:4'), env)).toBe(true);
		expect(await gate(headers('192.0.2.5'), env)).toBe(false);
	});
	it('ignores untrusted forwarding headers and rejects malformed addresses', async () => {
		const gate = networkGate(async () => ['192.0.2.4']);
		expect(await gate(new Headers({ 'x-forwarded-for': '192.0.2.4' }), env)).toBe(false);
		expect(await gate(headers('192.0.2.4, 1.2.3.4'), env)).toBe(false);
		expect(normalizeIP('127.0.0.1:80')).toBe(null);
		expect(normalizeIP('fe80::1%en0')).toBe(null);
	});
	it('refreshes DDNS cache and never uses stale data on failure', async () => {
		let now = 0;
		let address = '192.0.2.4';
		let failed = false;
		const gate = networkGate(
			async () => {
				if (failed) throw Error('DNS');
				return [address];
			},
			() => now
		);
		expect(await gate(headers(address), env)).toBe(true);
		address = '192.0.2.5';
		now = 30001;
		expect(await gate(headers('192.0.2.4'), env)).toBe(false);
		expect(await gate(headers(address), env)).toBe(true);
		now = 60002;
		failed = true;
		expect(await gate(headers(address), env)).toBe(false);
	});
	it('bypasses only nonproduction and fails closed on absent DNS', async () => {
		const gate = networkGate(async () => []);
		expect(await gate(new Headers(), { VERCEL_ENV: 'preview' })).toBe(true);
		expect(await gate(new Headers(), {})).toBe(true);
		expect(await gate(headers('1.2.3.4'), env)).toBe(false);
		expect(await gate(headers('1.2.3.4'), { VERCEL_ENV: 'production' })).toBe(false);
	});
});
