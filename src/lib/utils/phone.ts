/**
 * Phone-number helpers shared by every place a number is typed (verification card,
 * invitation dialog, member modal, signup). Mirrors `sms.utils.normalize_phone_number`
 * in revel-backend: strip formatting, infer the deployment's default country code for a
 * bare national number, then check strict E.164. The backend validates again.
 */

export const E164_RE = /^\+[1-9]\d{6,14}$/;

/** Strip spaces, dashes, dots and parentheses. */
export function stripPhoneFormatting(raw: string): string {
	return raw.replace(/[\s\-().]/g, '');
}

/**
 * Normalise user input to E.164 where possible.
 *
 * With a `defaultPrefix` such as `+1`: ten bare digits become `+1` + digits, and
 * eleven digits that already start with the prefix's own digits get a leading `+`.
 * Everything else is returned stripped but otherwise untouched.
 */
export function normalizePhoneInput(raw: string, defaultPrefix: string | null | undefined): string {
	const number = stripPhoneFormatting(raw);
	if (defaultPrefix && /^\d+$/.test(number)) {
		const prefixDigits = defaultPrefix.replace(/^\+/, '');
		if (number.length === 10) return `${defaultPrefix}${number}`;
		if (number.length === prefixDigits.length + 10 && number.startsWith(prefixDigits)) {
			return `+${number}`;
		}
	}
	return number;
}

export function isE164(number: string): boolean {
	return E164_RE.test(number);
}
