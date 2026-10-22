<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventpublicguestlinkGetGuestLink,
		eventpublicguestlinkRsvp
	} from '$lib/api/generated/sdk.gen';
	import type { GuestLinkSchema, RsvpStatus } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { formatEventDate } from '$lib/utils/date';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { Calendar, MapPin, Loader2, AlertCircle, Check, Smartphone } from '@lucide/svelte';

	interface Props {
		/** The `/g/<code>` code from the texted link. */
		code: string;
	}

	const { code }: Props = $props();

	const queryClient = useQueryClient();
	const queryKey = $derived(['guest-link', code]);

	class LinkError extends Error {
		status: number | undefined;
		constructor(status: number | undefined) {
			super('guest link');
			this.status = status;
		}
	}

	const linkQuery = createQuery(() => ({
		queryKey,
		queryFn: async (): Promise<GuestLinkSchema> => {
			const result = await eventpublicguestlinkGetGuestLink({ path: { code } });
			if (result.error || !result.data) throw new LinkError(result.response?.status);
			return result.data;
		},
		retry: false
	}));

	let saved = $state(false);
	let errorMessage = $state('');

	const rsvpMutation = createMutation(() => ({
		mutationFn: async (answer: RsvpStatus) => {
			const result = await eventpublicguestlinkRsvp({ path: { code, answer } });
			if (result.error) throw result.error;
			return result.data;
		},
		onSuccess: (data) => {
			errorMessage = '';
			saved = true;
			queryClient.setQueryData<GuestLinkSchema>(queryKey, (old) =>
				old ? { ...old, rsvp_status: data?.status ?? old.rsvp_status } : old
			);
		},
		onError: (error: unknown) => {
			saved = false;
			errorMessage = extractErrorMessage(error, m['guestLink.failed']());
		}
	}));

	const link = $derived(linkQuery.data);
	const errorStatus = $derived(
		linkQuery.error instanceof LinkError ? linkQuery.error.status : undefined
	);
	const answers: RsvpStatus[] = ['yes', 'maybe', 'no'];
	const answerLabel: Record<RsvpStatus, () => string> = {
		yes: m['guestLink.yes'],
		maybe: m['guestLink.maybe'],
		no: m['guestLink.no']
	};

	const location = $derived(link?.event.venue?.name ?? link?.event.city?.name ?? null);
	const eventHref = $derived(link ? resolve('/(public)/events/[id]', { id: link.event.id }) : null);
	// Signing up from here carries the code along: the backend merges this guest into the
	// new account and marks the number verified (the text already proved possession).
	const registerHref = $derived(
		`${resolve('/(public)/register', {})}?g=${encodeURIComponent(code)}`
	);
</script>

{#if linkQuery.isLoading}
	<div class="flex items-center justify-center gap-2 py-12 text-muted-foreground">
		<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		<span>{m['guestLink.loading']()}</span>
	</div>
{:else if !link}
	<Alert variant="destructive">
		<AlertCircle class="h-4 w-4" />
		<AlertDescription>
			{errorStatus === 410 ? m['guestLink.expired']() : m['guestLink.notFound']()}
		</AlertDescription>
	</Alert>
{:else}
	<div class="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="space-y-1">
			<p class="text-sm font-medium uppercase tracking-wide text-primary">
				{m['guestLink.title']()}
			</p>
			<h1 class="text-2xl font-bold">{link.event.name}</h1>
			<p class="text-sm text-muted-foreground">{link.event.organization.name}</p>
		</div>

		<dl class="space-y-2 text-sm">
			<div class="flex items-start gap-2">
				<Calendar class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<dd>{formatEventDate(link.event.start, link.event.timezone)}</dd>
			</div>
			{#if location}
				<div class="flex items-start gap-2">
					<MapPin class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<dd>{location}</dd>
				</div>
			{/if}
			<div class="flex items-start gap-2">
				<Smartphone class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<dd class="text-muted-foreground">
					{m['guestLink.invitedAs']({
						name: link.display_name,
						phone: link.phone_number_masked ?? ''
					})}
				</dd>
			</div>
		</dl>

		{#if link.can_rsvp}
			<div class="space-y-3">
				<p class="font-medium">{m['guestLink.rsvpQuestion']()}</p>
				<div class="grid grid-cols-3 gap-2" role="group" aria-label={m['guestLink.rsvpQuestion']()}>
					{#each answers as answer (answer)}
						{@const selected = link.rsvp_status === answer}
						<Button
							variant={selected ? 'default' : 'outline'}
							aria-pressed={selected}
							disabled={rsvpMutation.isPending}
							onclick={() => rsvpMutation.mutate(answer)}
						>
							{#if selected}
								<Check class="mr-1 h-4 w-4" aria-hidden="true" />
							{/if}
							{answerLabel[answer]()}
						</Button>
					{/each}
				</div>
				{#if saved}
					<p class="text-sm text-success" role="status">{m['guestLink.saved']()}</p>
				{/if}
				{#if errorMessage}
					<Alert variant="destructive">
						<AlertCircle class="h-4 w-4" />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				{/if}
				<p class="text-xs text-muted-foreground">{m['guestLink.changeAnytime']()}</p>
			</div>
		{:else}
			<Alert>
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>{m['guestLink.needsTicket']()}</AlertDescription>
			</Alert>
		{/if}

		<div class="space-y-2 border-t border-border pt-4">
			<p class="text-sm text-muted-foreground">{m['guestLink.createAccountHint']()}</p>
			<div class="flex flex-wrap items-center gap-3">
				<Button variant="secondary" size="sm" href={registerHref}
					>{m['guestLink.createAccount']()}</Button
				>
				{#if eventHref}
					<Button variant="link" href={eventHref} class="h-auto p-0"
						>{m['guestLink.viewEvent']()}</Button
					>
				{/if}
			</div>
		</div>
	</div>
{/if}
