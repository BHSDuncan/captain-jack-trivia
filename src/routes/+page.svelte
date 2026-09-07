<script lang="ts">
	let { data } = $props();
</script>

<section class="hero">
	<div>
		<p class="eyebrow">A gathering of curious minds</p>
		<h1>A little knowledge.<br /><em>A little friendly rivalry.</em></h1>
		<p class="lede">
			Pull up a chair. Put your wits to work. There’s a new challenge every month at Captain Jack.
		</p>
	</div>
	<div class="compass" aria-hidden="true">
		<span>N</span>
		<div>
			<svg
				viewBox="0 0 160 160"
				width="160"
				height="160"
				fill="none"
				stroke="currentColor"
				stroke-width="1"
				><path d="M80 6 92 68 154 80 92 92 80 154 68 92 6 80 68 68Z" /><path
					d="M80 6 80 80 92 68ZM154 80 80 80 92 92ZM80 154 80 80 68 92ZM6 80 80 80 68 68Z"
					fill="currentColor"
				/><path d="m35 35 37 33m56-33-36 33m36 60-36-36m-57 36 33-36" /><circle
					cx="80"
					cy="80"
					r="6"
					fill="#10191e"
				/></svg
			>
		</div>
		<small>FORTUNE FAVOURS<br />THE CURIOUS</small>
	</div>
</section>
{#each data.wins as win}<section class="winner">
		<p class="eyebrow">Your name in the captain’s log · {win.month}</p>
		<h2>You’ve won, {data.player?.nickname}.</h2>
		<p class="preserve">{win.message}</p>
		<a href="/history/{win.id}">View your winning screen →</a>
	</section>{/each}
{#if data.setup}<section class="panel">
		<h2>The harbour is being prepared.</h2>
		<p>Trivia will be ready soon. Please check back.</p>
	</section>
{:else if !data.barNetwork}<section class="panel">
		<p class="eyebrow">Reserved for the crew in the room</p>
		<h2>Join Captain Jack’s Wi-Fi to play.</h2>
		<p>Connect to the bar’s Wi-Fi, turn off any VPN or private relay, then refresh this page.</p>
		<a class="button" href="/">I’m connected — try again</a>
	</section>
{:else if data.contest}<section class="contest-panel">
		<div>
			<p class="eyebrow">{data.contest.month} · The current challenge</p>
			<h2>{data.contest.title}</h2>
			<p class="preserve">{data.contest.message}</p>
		</div>
		<div class="play-summary">
			<p class="number">{data.used}<span> / {data.contest.total}</span></p>
			<p>questions attempted</p>
			{#if data.contest.state === 'paused'}<p role="status">
					The captain has paused this contest. Check back shortly.
				</p>{:else if !data.player}<a class="button" href="/join">Step aboard</a
				>{:else if data.active}<a class="button" href="/play/{data.contest.id}"
					>Return to your question</a
				>{:else if data.available > 0}<p>{data.available} questions ready for you.</p>
				<a class="button" href="/play/{data.contest.id}">Test your knowledge</a>{:else}<p
					role="status"
				>
					{data.used === data.contest.total
						? 'All done. Keep an eye on the standings.'
						: 'You’re caught up. More questions unlock in the next weekly period.'}
				</p>{/if}
		</div>
	</section>
	<details class="rules">
		<summary>The rules of engagement</summary>
		<p>
			Free entry. {data.contest.quota} questions unlock per seven-day period; unused allowance carries
			forward. Each question counts as an attempt when opened. Timers continue if you leave the page.
		</p>
		<p>
			Most correct answers wins. Ties use the shortest total response time for correct answers;
			exact ties result in joint winners. Scores are live; correct options are revealed after closing.
		</p>
		<p class="preserve">{data.contest.rules}</p>
	</details>
{:else}<section class="panel">
		<h2>The next challenge is on the horizon.</h2>
		<p>No contest is open right now. Visit the past voyages to see previous winners.</p>
		<a href="/history">Read the captain’s log →</a>
	</section>{/if}
<section class="how">
	<div>
		<span>01</span>
		<h3>Make yourself known</h3>
		<p>A nickname. A six-digit PIN. No inbox to check.</p>
	</div>
	<div>
		<span>02</span>
		<h3>Trust your first instinct</h3>
		<p>Timed questions, one attempt each. Take a break between questions.</p>
	</div>
	<div>
		<span>03</span>
		<h3>Climb the standings</h3>
		<p>Return through the month and put your name in the captain’s log.</p>
	</div>
</section>
