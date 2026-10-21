<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Smartphone } from '@lucide/svelte';

	interface Props {
		checked: boolean;
		/** Whole form disabled (silence-all, saving, …). */
		disabled: boolean;
		/** The user's phone is verified; otherwise the toggle is locked with a hint. */
		verified: boolean;
		/** Unsubscribe mode has no session, so verification can't be checked — don't lock. */
		unsubscribeMode: boolean;
		onToggle: () => void;
	}

	const { checked, disabled, verified, unsubscribeMode, onToggle }: Props = $props();

	const locked = $derived(!unsubscribeMode && !verified);
</script>

<!-- SMS channel: allow-listed notification types only; needs a verified phone -->
<div class="flex items-start justify-between space-x-4">
	<div class="flex flex-1 items-start gap-3">
		<Smartphone
			class="mt-1 h-5 w-5 {checked ? 'text-primary' : 'text-muted-foreground'}"
			aria-hidden="true"
		/>
		<div class="flex-1 space-y-1">
			<Label for="channel-sms" class="text-base font-medium"
				>{m['notificationPreferences.channelSms']()}</Label
			>
			<p class="text-sm text-muted-foreground">
				{m['notificationPreferences.channelSmsDescription']()}
			</p>
			{#if locked}
				<div class="mt-2 rounded-md bg-muted p-2">
					<p id="sms-not-verified" class="text-xs text-muted-foreground">
						{m['notificationPreferences.smsNotVerified']()}
						<a
							href={resolve('/(auth)/account/profile', {})}
							class="font-medium text-primary underline-offset-4 hover:underline"
						>
							{m['notificationPreferences.verifyPhone']()}
						</a>
					</p>
				</div>
			{/if}
		</div>
	</div>
	<Checkbox
		id="channel-sms"
		{checked}
		onCheckedChange={onToggle}
		disabled={disabled || locked}
		aria-label={m['notificationPreferences.channelSms']()}
		aria-describedby={locked ? 'sms-not-verified' : undefined}
	/>
</div>
