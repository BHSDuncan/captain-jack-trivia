<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import NetworkDiagnostics from '$lib/NetworkDiagnostics.svelte';
	onMount(() => {
		document.documentElement.dataset.hydrated = 'true';
	});
	let { data, children } = $props();
</script>

<svelte:head
	><title>Captain Jack · The Monthly Challenge</title><meta
		name="description"
		content="A little knowledge. A little friendly rivalry. Monthly trivia at Captain Jack."
	/></svelte:head
>
<a href="#main" class="skip">Skip to content</a>
<header class="masthead">
	<a class="brand" href="/" aria-label="Captain Jack home"
		><span class="brand-mark" aria-hidden="true"
			><svg viewBox="0 0 40 48" fill="none" stroke="currentColor" stroke-width="1.5"
				><circle cx="20" cy="8" r="4" /><path
					d="M20 12v29M9 20h22M5 29c0 11 9 11 15 16 6-5 15-5 15-16M2 33l3-5 5 3M30 31l5-3 3 5"
				/></svg
			></span
		><span>CAPTAIN JACK<small>THE MONTHLY CHALLENGE</small></span></a
	>
	<nav aria-label="Main">
		<a href="/leaderboard">The standings</a><a href="/history">Past voyages</a>{#if data.player}<a
				href="/join">{data.player.nickname}</a
			>{:else}<a href="/join">Step aboard</a>{/if}
	</nav>
</header>
<main id="main">{@render children()}
	{#if data.networkDiagnostic}<NetworkDiagnostics diagnostic={data.networkDiagnostic} />{/if}
</main>
<footer>
	<span>CAPTAIN JACK <span class="muted">· Knowledge earns its keep.</span></span><a href="/admin"
		>The captain’s desk</a
	>
</footer>
