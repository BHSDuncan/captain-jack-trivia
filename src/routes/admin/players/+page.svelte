<script lang="ts">
	let { data } = $props();
</script>

<section>
	<p class="eyebrow">Crew manifest</p>
	<h1>Players & scores.</h1>
	{#each data.players as p}<a class="ledger-link" href="/admin/players/{p.id}"
			><span>{p.nickname}</span><span>Joined {p.createdAt.slice(0, 10)}</span></a
		>{:else}<p>No players have joined yet.</p>{/each}
</section>
