<script lang="ts">
	import { page } from '$app/state';
</script>

<section class="narrow">
	<p class="eyebrow">A moment ashore</p>
	<h1>{page.status === 403 ? 'Join the crew on Wi-Fi.' : 'We hit a snag.'}</h1>
	<p>{page.error?.message}</p>
	<a class="button" href="/">Back to the harbour</a>
</section>
