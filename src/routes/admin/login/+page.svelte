<script lang="ts">
	let { form } = $props();
</script>

<section class="narrow">
	<p class="eyebrow">Authorised crew only</p>
	<h1>The captain’s desk.</h1>
	<form method="POST" class="stack">
		<label>Email<input type="email" name="email" autocomplete="username" required /></label><label
			>Password<input
				type="password"
				name="password"
				autocomplete="current-password"
				required
			/></label
		>{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}<button class="button"
			>Open the ledger</button
		>
		<p class="muted">Forgot your password? Contact the application operator for a reset.</p>
	</form>
</section>
