<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let clock = $state(0);
	let busy = $state(false);
	let connectionError = $state('');
	let offset = $state(0);
	onMount(() => {
		offset = data.serverNow - Date.now();
		clock = Date.now() + offset;
		const interval = setInterval(() => (clock = Date.now() + offset), 200);
		return () => clearInterval(interval);
	});
	let remaining = $derived(
		data.active
			? Math.max(
					0,
					Math.ceil((Date.parse(data.active.deadline) - (clock || data.serverNow)) / 1000)
				)
			: 0
	);
</script>

<section class="question-shell">
	<p class="eyebrow">{data.contest.title} · Question {data.used || 1}</p>
	{#if form?.error}<p role="alert" class="error">{form.error}</p>{/if}
	{#if connectionError}<p role="alert" class="error">{connectionError}</p>{/if}
	{#if data.contest.state === 'closed'}<h1>The final bell has rung.</h1>
		<a class="button" href="/history/{data.contest.id}">View the results</a>
	{:else if data.contest.state === 'paused'}<h1>A pause in proceedings.</h1>
		<p>The contest is paused. If you had a question open, its timer continues.</p>
		<a class="button" href="/play/{data.contest.id}">Check again</a>
	{:else if data.active}<div class="question-top">
			<span>Trust your knowledge.</span><span
				class:urgent={remaining <= 5}
				class="timer"
				role="timer"
				aria-label={`${remaining} seconds remaining`}>{remaining}<small> sec</small></span
			>
		</div>
		<h1 class="question-title">{data.active.text}</h1>
		<form
			method="POST"
			action="?/answer"
			use:enhance={() => {
				busy = true;
				connectionError = '';
				return async ({ result, update }) => {
					try {
						if (result.type === 'error') {
							connectionError =
								'Connection interrupted. Reconnect and retry before the timer runs out. Your question has been kept.';
							return;
						}
						await update();
					} finally {
						busy = false;
					}
				};
			}}
		>
			<input type="hidden" name="attemptId" value={data.active.id} />
			<div class="answers">
				{#each data.active.options as option, i}<button
						name="answer"
						value={option.id}
						disabled={busy || remaining === 0}
						><span>{String.fromCharCode(65 + i)}</span>{option.text}</button
					>{/each}
			</div>
			{#if remaining === 0}<p role="status">Time’s up. This question counts as an attempt.</p>
				<button class="button" name="answer" value="" disabled={busy}>Continue</button>{/if}
		</form>
		<p class="muted">
			{busy
				? 'Recording your answer…'
				: 'Your first answer is final. The timer keeps running if you leave.'}
		</p>
	{:else}<p class="eyebrow">{form?.recorded ? 'Answer recorded' : 'Ready when you are'}</p>
		<h1>{data.available > 0 ? 'A fresh question awaits.' : 'You’re caught up.'}</h1>
		<p>
			{data.available > 0
				? `${data.available} questions available. Take a breath before the next one; its timer starts when you open it.`
				: 'Your available questions are complete. Visit the standings or return when more unlock.'}
		</p>
		{#if data.available > 0}<form method="POST" action="?/start">
				<button class="button">Open the next question</button>
			</form>{/if}<a class="text-link" href="/">Back to the harbour</a>{/if}
</section>
