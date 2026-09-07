<script lang="ts">
	let { data } = $props();
</script>

<section>
	<p class="eyebrow">The captain’s desk</p>
	<h1>Keep a steady course.</h1>
	<div class="metrics">
		<div><strong>{data.players}</strong><span>Total registered players</span></div>
		<div><strong>{data.participants}</strong><span>This month’s participants</span></div>
		<div><strong>{data.attempts}</strong><span>Questions attempted</span></div>
		<div><strong>{data.contests.length}</strong><span>Monthly contests</span></div>
	</div>
	<h2>The contest ledger</h2>
	{#each data.contests as c}<a class="ledger-link" href="/admin/contests/{c.id}"
			><span>{c.month} · {c.title}</span><span class="badge">{c.state}</span></a
		>{:else}<p>Create your first contest to get started.</p>{/each}<a
		class="button"
		href="/admin/contests/new">Prepare a new contest</a
	>{#if data.leaders.length}<h2>Provisional leaders</h2>
		{#each data.leaders as p}<p>
				{p.rank}. {p.nickname} — {p.correct} correct · {(p.elapsedMs / 1000).toFixed(3)} seconds
			</p>{/each}{/if}
	<h2>Recent activity</h2>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to focus and scroll this region.) -->
	<div class="table-scroll" tabindex="0" role="region" aria-label="Recent activity table">
		<table>
			<thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Detail</th></tr></thead><tbody
				>{#each data.events as e}<tr
						><td>{new Date(e.at).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</td><td
							>{e.action}</td
						><td>{e.actor}</td><td class="small">{e.detail}</td></tr
					>{/each}</tbody
			>
		</table>
	</div>
</section>

<style>
	@media (min-width: 701px) {
		.metrics {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
