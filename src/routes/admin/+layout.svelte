<script lang="ts">
	import { page } from '$app/state';
	let { children } = $props();
</script>

{#if page.url.pathname !== '/admin/login'}<nav class="admin-nav" aria-label="Administration">
		<a href="/admin">Overview</a><a href="/admin/contests/new">New contest</a><a
			href="/admin/players">Players & scores</a
		>
		<form method="POST" action="/admin?/logout"><button class="subtle">Sign out</button></form>
	</nav>{/if}{@render children()}
