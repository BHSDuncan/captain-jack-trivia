<script lang="ts">
	let { data } = $props();
</script>

<section>
	<p class="eyebrow">Crew member · Joined {data.profile.joined.slice(0, 10)}</p>
	<h1>{data.profile.nickname}</h1>
	<h2>Attempt history</h2>
	{#each data.attempts as a}<article class="review">
			<h3>{a.text}</h3>
			<p>
				{a.status} · {a.correct ? 'Correct' : 'Not correct / unfinished'}{a.elapsedMs !== null
					? ` · ${(a.elapsedMs / 1000).toFixed(3)} seconds`
					: ''}
			</p>
			<a href="/admin/contests/{a.contestId}">View contest</a>
		</article>{/each}
	<h2>Identity activity</h2>
	{#each data.events as e}<p>{e.at} · {e.action}</p>{:else}<p>
			No flagged identity activity.
		</p>{/each}
</section>
