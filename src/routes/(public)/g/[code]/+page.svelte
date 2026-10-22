<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import GuestLinkRsvp from '$lib/components/events/GuestLinkRsvp.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m['guestLink.title']()} - Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container max-w-lg px-4 py-8">
	<GuestLinkRsvp code={data.code} />
</div>
