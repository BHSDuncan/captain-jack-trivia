<script lang="ts">
	let { data } = $props();
</script>

<section>
	<p class="eyebrow">Friendly rivalry, faithfully recorded</p>
	<h1>The standings.</h1>
	<p>{data.contest?.title ?? 'No contest is open.'}</p>
	{#if data.rows.length}<table>
			<thead
				><tr><th scope="col">Player</th><th scope="col" class="numeric">Correct answers</th></tr
				></thead
			><tbody
				>{#each data.rows as row}<tr
						><td>{row.nickname}</td><td class="numeric">{row.correct}</td></tr
					>{/each}</tbody
			>
		</table>
		<p class="muted">
			Equal scores are listed alphabetically. Final ties use total correct-answer time, revealed
			after closing.
		</p>{:else}<p>The first name on this ledger could be yours.</p>{/if}
</section>
