<script lang="ts">
	let {
		question = null,
		disabled = false
	}: {
		question?: {
			_id: string;
			text: string;
			options: string[];
			correct: number;
			seconds: number | null;
		} | null;
		disabled?: boolean;
	} = $props();
</script>

<form method="POST" action="?/question" class="stack question-editor">
	<input type="hidden" name="questionId" value={question?._id || ''} />
	<fieldset {disabled}>
		<legend>{question ? 'Edit question' : 'New question'}</legend><label
			>Question text<textarea name="text" required maxlength="1000">{question?.text || ''}</textarea
			></label
		>
		<p class="muted">
			Fill 2–6 distinct options. Select the correct option. Leave unused options blank.
		</p>
		{#each Array(6) as _, i}<div class="option-editor">
				<label class="radio"
					><input
						type="radio"
						name="correct"
						value={i}
						checked={(question?.correct ?? 0) === i}
						required
					/><span class="sr-only">Option {i + 1} is correct</span></label
				><label
					>Option {i + 1}<input
						name="option"
						value={question?.options[i] || ''}
						maxlength="200"
						required={i < 2}
					/></label
				>
			</div>{/each}<label
			>Timer override in seconds (optional)<input
				type="number"
				name="seconds"
				min="5"
				max="120"
				value={question?.seconds ?? ''}
			/></label
		>{#if !disabled}<button class="button">Save question</button>{/if}
	</fieldset>
	{#if question && !disabled}<button class="danger" name="delete" value="yes" formnovalidate
			>Delete this draft question</button
		>{/if}
</form>
