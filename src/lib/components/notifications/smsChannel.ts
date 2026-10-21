import type { NotificationType } from '$lib/api/generated/types.gen.js';

/**
 * Mirrors `SMS_ELIGIBLE_TYPES` in revel-backend `notifications/enums.py`. SMS is an
 * allowlist, not a peer of email: the backend strips it from every other type (including
 * the mandatory ones), so offering the checkbox elsewhere would be a lie.
 */
const SMS_ELIGIBLE_TYPES: ReadonlySet<string> = new Set<NotificationType>([
	'event_reminder',
	'ticket_created',
	'event_cancelled',
	'waitlist_spot_available'
]);

export function isSmsEligibleType(type: string): boolean {
	return SMS_ELIGIBLE_TYPES.has(type);
}
