<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { Smartphone, Loader2, AlertCircle } from '@lucide/svelte';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { smsStatus, smsRequestCode, smsVerify, smsRemovePhone } from '$lib/api/generated/sdk.gen';
	import { extractErrorMessage } from '$lib/utils/errors';

	interface Props {
		authToken: string;
	}

	const { authToken }: Props = $props();

	const queryClient = useQueryClient();
	const auth = $derived({ headers: { Authorization: `Bearer ${authToken}` } });

	const statusQuery = createQuery(() => ({
		queryKey: ['sms', 'phone-status'],
		queryFn: async () => {
			const result = await smsStatus(auth);
			return result.data;
		}
	}));

	// Dialog state: 'number' (enter + consent) -> 'code' (enter the texted code)
	let showDialog = $state(false);
	let showRemoveConfirm = $state(false);
	let step = $state<'number' | 'code'>('number');
	let phoneValue = $state('');
	let codeValue = $state('');
	let fieldError = $state('');

	const isVerified = $derived(statusQuery.data?.verified ?? false);
	const maskedNumber = $derived(statusQuery.data?.phone_number ?? null);

	const requestCodeMutation = createMutation(() => ({
		mutationFn: async (phoneNumber: string) => {
			const result = await smsRequestCode({ ...auth, body: { phone_number: phoneNumber } });
			if (result.error) throw result.error;
			return result.data;
		},
		onSuccess: () => {
			step = 'code';
			codeValue = '';
			fieldError = '';
		},
		onError: (error: unknown) => {
			fieldError = extractErrorMessage(error, m['sms.errorGeneric']());
		}
	}));

	const verifyMutation = createMutation(() => ({
		mutationFn: async (code: string) => {
			const result = await smsVerify({ ...auth, body: { code } });
			if (result.error) throw result.error;
			return result.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(['sms', 'phone-status'], data);
			queryClient.invalidateQueries({ queryKey: ['sms', 'phone-status'] });
			showDialog = false;
		},
		onError: (error: unknown) => {
			fieldError = extractErrorMessage(error, m['sms.errorGeneric']());
		}
	}));

	const removeMutation = createMutation(() => ({
		mutationFn: async () => {
			const result = await smsRemovePhone(auth);
			if (result.error) throw result.error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sms', 'phone-status'] });
			showRemoveConfirm = false;
		}
	}));

	const isBusy = $derived(requestCodeMutation.isPending || verifyMutation.isPending);

	// Reset the dialog when it closes
	$effect(() => {
		if (!showDialog) {
			step = 'number';
			phoneValue = '';
			codeValue = '';
			fieldError = '';
		}
	});

	function handleSendCode() {
		const cleaned = phoneValue.replace(/[\s\-().]/g, '');
		if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
			fieldError = m['sms.phoneHelp']();
			return;
		}
		requestCodeMutation.mutate(cleaned);
	}

	function handleVerify() {
		const cleaned = codeValue.replace(/\s/g, '');
		if (!/^\d{6}$/.test(cleaned)) {
			fieldError = m['sms.codeError']();
			return;
		}
		verifyMutation.mutate(cleaned);
	}

	function handlePrimary() {
		if (step === 'number') handleSendCode();
		else handleVerify();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		handlePrimary();
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Smartphone class="h-6 w-6 text-primary" aria-hidden="true" />
			<div>
				<h3 class="text-lg font-semibold">{m['sms.heading']()}</h3>
				<p class="text-sm text-muted-foreground">{m['sms.description']()}</p>
			</div>
		</div>

		{#if statusQuery.isLoading}
			<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
		{:else if isVerified}
			<StatusBadge tone="success" label={m['sms.status_verified']()} />
		{/if}
	</div>

	{#if statusQuery.isLoading}
		<div class="flex items-center justify-center py-8">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
		</div>
	{:else if isVerified && maskedNumber}
		<div class="rounded-md border border-border bg-muted/50 p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm font-medium">
						{m['sms.status_verifiedAs']({ number: maskedNumber })}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['sms.status_verifiedDescription']()}
					</p>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={() => (showDialog = true)}>
						{m['sms.buttons_changeNumber']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (showRemoveConfirm = true)}
						disabled={removeMutation.isPending}
					>
						{m['sms.buttons_remove']()}
					</Button>
				</div>
			</div>
		</div>
	{:else}
		<div class="rounded-md border border-border bg-muted/50 p-4">
			<p class="mb-3 text-sm text-muted-foreground">{m['sms.notVerified_description']()}</p>
			<Button onclick={() => (showDialog = true)}>
				<Smartphone class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['sms.buttons_add']()}
			</Button>
		</div>
	{/if}
</div>

<!-- Add / verify dialog -->
<Dialog bind:open={showDialog}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['sms.add_title']()}</DialogTitle>
			<DialogDescription>{m['sms.add_description']()}</DialogDescription>
		</DialogHeader>

		<form class="space-y-4" onsubmit={handleSubmit}>
			{#if step === 'number'}
				<div class="space-y-2">
					<Label for="sms-phone">{m['sms.phoneLabel']()}</Label>
					<Input
						id="sms-phone"
						type="tel"
						autocomplete="tel"
						inputmode="tel"
						placeholder="+1 555 123 4567"
						bind:value={phoneValue}
						oninput={() => (fieldError = '')}
						aria-invalid={!!fieldError}
						aria-describedby={fieldError ? 'sms-field-error' : 'sms-phone-help'}
						disabled={requestCodeMutation.isPending}
						class={fieldError ? 'border-destructive' : ''}
					/>
					<p id="sms-phone-help" class="text-xs text-muted-foreground">{m['sms.phoneHelp']()}</p>
				</div>
				<p class="text-xs text-muted-foreground">{m['sms.consent']()}</p>
			{:else}
				<div class="space-y-2">
					<Label for="sms-code">{m['sms.codeLabel']()}</Label>
					<p class="text-sm text-muted-foreground">
						{m['sms.codeSentTo']({ number: phoneValue })}
					</p>
					<Input
						id="sms-code"
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						placeholder="123 456"
						maxlength={7}
						bind:value={codeValue}
						oninput={() => (fieldError = '')}
						aria-invalid={!!fieldError}
						aria-describedby={fieldError ? 'sms-field-error' : undefined}
						disabled={verifyMutation.isPending}
						class={fieldError ? 'border-destructive' : ''}
					/>
					<Button
						type="button"
						variant="link"
						size="sm"
						class="h-auto p-0"
						onclick={() => (step = 'number')}
						disabled={verifyMutation.isPending}
					>
						{m['sms.buttons_changeNumber']()}
					</Button>
				</div>
			{/if}

			{#if fieldError}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription id="sms-field-error">{fieldError}</AlertDescription>
				</Alert>
			{/if}

			<DialogFooter class="flex-col gap-2 sm:flex-row sm:justify-between">
				<Button
					type="button"
					variant="outline"
					onclick={() => (showDialog = false)}
					disabled={isBusy}
					class="w-full sm:w-auto"
				>
					{m['sms.buttons_cancel']()}
				</Button>
				<Button
					type="submit"
					disabled={isBusy || (step === 'number' ? !phoneValue.trim() : !codeValue.trim())}
					class="w-full sm:w-auto"
				>
					{#if isBusy}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{step === 'number' ? m['sms.buttons_sending']() : m['sms.buttons_verifying']()}
					{:else}
						{step === 'number' ? m['sms.buttons_sendCode']() : m['sms.buttons_verify']()}
					{/if}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>

<!-- Remove confirmation -->
<Dialog bind:open={showRemoveConfirm}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['sms.remove_title']()}</DialogTitle>
			<DialogDescription>{m['sms.remove_description']()}</DialogDescription>
		</DialogHeader>

		<Alert>
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>{m['sms.remove_warning']()}</AlertDescription>
		</Alert>

		<DialogFooter class="flex-col gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				onclick={() => (showRemoveConfirm = false)}
				disabled={removeMutation.isPending}
				class="w-full sm:w-auto"
			>
				{m['sms.buttons_cancel']()}
			</Button>
			<Button
				type="button"
				variant="destructive"
				onclick={() => removeMutation.mutate()}
				disabled={removeMutation.isPending}
				class="w-full sm:w-auto"
			>
				{#if removeMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['sms.buttons_removing']()}
				{:else}
					{m['sms.buttons_removeConfirm']()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
