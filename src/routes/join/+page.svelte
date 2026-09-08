<script lang="ts">
	let { data, form } = $props();
	let mode = $state('register');
</script>

<section class="narrow">
	<p class="eyebrow">Your place in the crew</p>
	<h1>{data.player ? `Welcome, ${data.player.nickname}.` : 'Step aboard.'}</h1>
	{#if data.player}<p>
			Your browser remembers you. Keep your nickname and PIN safe so you can return on another
			device. We don’t collect your email or phone number.
		</p>
		<a class="button" href="/">Back to the challenge</a>
		<form method="POST" action="?/logout"><button class="subtle">Sign out</button></form>
	{:else if !data.barNetwork}<p>Join Captain Jack’s Wi-Fi to play.</p>
		<a class="button" href="/join" data-sveltekit-reload>I’m connected — try again</a>
	{:else}<div class="tabs">
			<button type="button" aria-pressed={mode === 'register'} class:chosen={mode === 'register'} onclick={() => (mode = 'register')}
				>New to the crew</button
			><button type="button" aria-pressed={mode === 'login'} class:chosen={mode === 'login'} onclick={() => (mode = 'login')}
				>Returning player</button
			>
		</div>
		<form method="POST" action="?/enter" class="stack">
			<input type="hidden" name="mode" value={mode} />
			<label
				>Your public nickname<input
					name="nickname"
					required
					minlength="2"
					maxlength="24"
					autocomplete="username"
				/></label
			><label
				>Six-digit PIN<input
					name="pin"
					required
					pattern={'[0-9]{6}'}
					maxlength="6"
					inputmode="numeric"
					type="password"
					autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
				/></label
			>{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}<button class="button"
				>{mode === 'register' ? 'Join the crew' : 'Sign in'}</button
			>
			<p class="muted">
				One player per person. This browser will be linked to your player profile to discourage
				duplicate registration. Store your PIN safely; there is no email recovery.
			</p>
		</form>{/if}
</section>
