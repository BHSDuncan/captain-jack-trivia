<script lang="ts">
	import type { NetworkDiagnostic } from './server/network';
	let { diagnostic }: { diagnostic: NetworkDiagnostic } = $props();
</script>

<aside aria-label="Temporary network diagnostics">
	<h2>Network check · temporary diagnostics</h2>
	<p>Screenshot this panel before and after joining Wi-Fi. It contains public IP addresses; share it privately.</p>
	<dl>
		<dt>Result</dt><dd>{diagnostic.allowed ? 'Allowed' : 'Denied'} — {diagnostic.reason}</dd>
		<dt>Server check time (UTC)</dt><dd>{diagnostic.checkedAt}</dd>
		<dt>Your IP as seen by this server</dt><dd>{diagnostic.clientIp ?? 'Missing or invalid'}</dd>
		<dt>Bar addresses returned by DNS</dt><dd>{diagnostic.addresses.join(', ') || 'None / not checked'}</dd>
		<dt>DNS source</dt><dd>{diagnostic.dnsSource}</dd>
		<dt>App DNS cache age</dt><dd>{diagnostic.dnsAgeMs === null ? 'Not checked' : `${diagnostic.dnsAgeMs} ms`}</dd>
	</dl>
	<p>A lookup may still use an upstream DNS cache. This check cannot detect Safari Private Relay, VPN settings, or your Wi-Fi network name.</p>
	<a class="button" href="?network-check" data-sveltekit-reload>Run a fresh network check</a>
</aside>

<style>
	aside { margin-block: 2rem; padding: 1rem; border: 1px solid var(--line); }
	dt { font-weight: 600; margin-top: 0.75rem; }
	dd { margin: 0; overflow-wrap: anywhere; }
</style>
