<script lang="ts">
	let { data } = $props();
</script>

<section>
	<p class="eyebrow">The final ledger · {data.month}</p>
	<h1>{data.title}</h1>
	{#if data.won}<div class="winner">
			<p class="eyebrow">{data.shared ? 'Joint winner' : 'Monthly winner'}</p>
			<h2>{data.player?.nickname}</h2>
			<p>{data.month}</p>
			<p class="preserve">{data.message}</p>
			{#if data.shared}<p>
					You share the top spot with the other tied winner{data.rows.filter((r) => r.rank === 1)
						.length > 2
						? 's'
						: ''}.
				</p>{/if}
		</div>{/if}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to focus and scroll this region.) -->
	<div class="table-scroll" tabindex="0" role="region" aria-label="Final standings table">
		<table>
			<thead
				><tr><th>Rank</th><th>Player</th><th>Correct</th><th>Correct-answer time</th></tr></thead
			><tbody
				>{#each data.rows as r}<tr
						><td>{r.rank}</td><td>{r.nickname}</td><td>{r.correct}</td><td
							>{(r.elapsedMs / 1000).toFixed(3)} s</td
						></tr
					>{/each}</tbody
			>
		</table>
	</div>
	{#if data.answers.length}<h2>Your answers</h2>
		{#each data.answers as a}<article class="review">
				<h3>{a.text}</h3>
				<p>Your answer: {a.submitted}</p>
				<p class:right={a.right}>Correct answer: {a.correct}</p>
			</article>{/each}{/if}
</section>
