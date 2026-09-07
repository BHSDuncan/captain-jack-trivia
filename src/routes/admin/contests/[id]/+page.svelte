<script lang="ts">
	import QuestionEditor from '$lib/QuestionEditor.svelte';
	let { data, form } = $props();
	const c = $derived(data.contest);
	const draft = $derived(!c || c.state === 'draft');
</script>

<section>
	<p class="eyebrow">{c ? `${c.month} · ${c.state}` : 'A new chapter'}</p>
	<h1>{c?.title || 'Prepare the challenge.'}</h1>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}{#if form?.success}<p
			role="status"
			class="notice"
		>
			{form.success}
		</p>{/if}
	<form method="POST" action="?/save" class="stack">
		<fieldset disabled={!draft}>
			<legend>Contest details</legend>
			<div class="form-grid">
				<label>Month<input type="month" name="month" required value={c?.month || ''} /></label
				><label>Title<input name="title" required maxlength="100" value={c?.title || ''} /></label
				><label
					>Start · Toronto time<input
						type="datetime-local"
						name="startsAt"
						required
						value={c?.startsAt || ''}
					/></label
				><label
					>End · Toronto time<input
						type="datetime-local"
						name="endsAt"
						required
						value={c?.endsAt || ''}
					/></label
				><label
					>Questions per week<input
						type="number"
						name="questionsPerWeek"
						required
						min="1"
						max="100"
						value={c?.questionsPerWeek ?? 5}
					/></label
				><label
					>Default seconds per question<input
						type="number"
						name="seconds"
						required
						min="5"
						max="120"
						value={c?.seconds ?? 20}
					/></label
				><label
					>Fixed prize description<input
						name="prize"
						required
						value={c?.prize || 'Captain Jack merchandise'}
					/></label
				><label
					>Prize value · CAD<input
						type="number"
						name="prizeValue"
						required
						min="0"
						max="100000"
						step="0.01"
						value={c?.prizeValue ?? 50}
					/></label
				>
			</div>
			<label
				>Contest rules<textarea name="rules" required rows="4"
					>{c?.rules ||
						'One player per person. Answer independently, without searching or outside assistance. No purchase necessary. Highest correct total wins; equal totals use the fastest total correct-answer time. Exact ties result in joint winners.'}</textarea
				></label
			><label
				>Public message<textarea name="message"
					>{c?.message || 'Five new questions unlock each week. Bring your curiosity.'}</textarea
				></label
			><label
				>Private winner message<textarea name="winnerMessage" required
					>{c?.winnerMessage ||
						'Congratulations, {nickname}! You won the {month} challenge. Show this screen to the owner.'}</textarea
				></label
			>
			<p class="muted">
				Winner placeholders: {'{nickname}'} and {'{month}'}. Publishing freezes questions and
				scoring settings.
			</p>
			{#if draft}<button class="button">Save contest details</button>{/if}
		</fieldset>
	</form>
	{#if c}{#if !draft}<details>
				<summary>Edit public and winner messages</summary>
				<form method="POST" action="?/messages" class="stack">
					<label>Public message<textarea name="message">{c.message}</textarea></label><label
						>Winner message<textarea name="winnerMessage" required>{c.winnerMessage}</textarea
						></label
					><button class="button">Save messages</button>
				</form>
			</details>{/if}
		<h2>Contest controls</h2>
		<form method="POST" action="?/lifecycle" class="stack">
			<label
				>Action<select name="action" aria-label="Action"
					>{#if c.state === 'draft'}<option value="publish">Publish contest</option
						>{/if}{#if c.state === 'scheduled'}<option value="draft"
							>Return to draft (before start only)</option
						>{/if}{#if c.state === 'active'}<option value="pause">Pause contest</option><option
							value="close">Close early and finalize</option
						>{/if}{#if c.state === 'paused'}<option value="resume">Resume contest</option><option
							value="close">Close early and finalize</option
						>{/if}{#if c.state === 'closed'}<option value="reopen"
							>Reopen contest and clear winner snapshot</option
						>{/if}</select
				></label
			>{#if c.state === 'closed'}<p class="error">
					Players may already have seen correct answers. Reopening retains attempts but can
					advantage anyone who learned those answers. Existing winner announcements will be
					withdrawn.
				</p>
				<label>New end · Toronto time<input type="datetime-local" name="newEnd" required /></label
				>{/if}<label class="checkbox"
				><input type="checkbox" name="confirm" value="yes" required />I confirm this change. It will
				be recorded in the audit log.</label
			><button class="button">Apply contest change</button>
		</form>
		<h2>Questions <span class="muted">({data.questions.length})</span></h2>
		{#each data.questions as q}<details>
				<summary>{q.text}</summary>
				<div class="preview">
					<p class="eyebrow">Question preview · {q.seconds ?? c.seconds} seconds</p>
					<h3>{q.text}</h3>
					<ol type="A">
						{#each q.options as option, i}<li>
								{option}{i === q.correct ? ' — correct' : ''}
							</li>{/each}
					</ol>
				</div>
				<QuestionEditor question={q} disabled={!draft} />
			</details>{/each}{#if draft}<QuestionEditor />{:else}<p class="muted">
				Published questions are frozen. A future scheduled contest can return to draft before it
				begins.
			</p>{/if}
		<h2>Scores</h2>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to focus and scroll this region.) -->
		<div class="table-scroll" tabindex="0" role="region" aria-label="Contest scores table">
			<table>
				<thead
					><tr><th>Rank</th><th>Player</th><th>Attempts</th><th>Correct</th><th>Time</th></tr
					></thead
				><tbody
					>{#each data.rows as r}<tr
							><td>{r.rank}</td><td><a href="/admin/players/{r.playerId}">{r.nickname}</a></td><td
								>{r.attempted}</td
							><td>{r.correct}</td><td>{(r.elapsedMs / 1000).toFixed(3)} s</td></tr
						>{/each}</tbody
				>
			</table>
		</div>{/if}
</section>
