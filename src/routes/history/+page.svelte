<script lang="ts">
	let { data } = $props();
</script>

<section>
	<p class="eyebrow">The captain’s log</p>
	<h1>Past voyages.</h1>
	{#each data.contests as c}<article class="history-row">
			<p class="eyebrow">{c.month}</p>
			<h2><a href="/history/{c.id}">{c.title}</a></h2>
			<p>
				{c.winners.length ? `Honours to ${c.winners.join(' & ')}` : 'No winning score this month.'}
			</p>
		</article>{:else}<p>The first chapter is still being written.</p>{/each}
</section>
