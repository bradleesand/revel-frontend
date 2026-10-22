import { describe, it, expect } from 'vitest';
import { isE164, normalizePhoneInput } from './phone';

describe('normalizePhoneInput', () => {
	it('infers the default country code for ten bare digits', () => {
		expect(normalizePhoneInput('(555) 123-4567', '+1')).toBe('+15551234567');
	});

	it('adds a plus to eleven digits that already carry the prefix', () => {
		expect(normalizePhoneInput('1 555 123 4567', '+1')).toBe('+15551234567');
	});

	it('leaves international and short numbers alone', () => {
		expect(normalizePhoneInput('+44 20 7946 0958', '+1')).toBe('+442079460958');
		expect(normalizePhoneInput('555-1234', '+1')).toBe('5551234');
		expect(normalizePhoneInput('5551234567', null)).toBe('5551234567');
	});

	it('validates E.164 strictly', () => {
		expect(isE164('+15551234567')).toBe(true);
		expect(isE164('5551234567')).toBe(false);
		expect(isE164('+05551234567')).toBe(false);
	});
});
