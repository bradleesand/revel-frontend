import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import PhoneConnectionManager from './PhoneConnectionManager.svelte';
import { smsStatus, smsRequestCode, smsVerify, smsRemovePhone } from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	smsStatus: vi.fn(),
	smsRequestCode: vi.fn(),
	smsVerify: vi.fn(),
	smsRemovePhone: vi.fn()
}));

type StatusResult = Awaited<ReturnType<typeof smsStatus>>;
type RequestResult = Awaited<ReturnType<typeof smsRequestCode>>;
type VerifyResult = Awaited<ReturnType<typeof smsVerify>>;

function ok<T>(data: T) {
	return { data, error: undefined, response: { ok: true, status: 200 } as Response };
}

function fail(detail: string, status = 400) {
	return { data: undefined, error: { detail }, response: { ok: false, status } as Response };
}

function renderManager() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: { client, component: PhoneConnectionManager, componentProps: { authToken: 'tok' } }
	});
}

describe('PhoneConnectionManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(smsStatus).mockResolvedValue(
			ok({ phone_number: null, verified: false, pending_verification: false }) as StatusResult
		);
	});

	it('walks through number -> code and shows the verified state', async () => {
		vi.mocked(smsRequestCode).mockResolvedValue(
			ok({ message: 'sent' }) as unknown as RequestResult
		);
		vi.mocked(smsVerify).mockResolvedValue(
			ok({
				phone_number: '+1••••••4567',
				verified: true,
				pending_verification: false
			}) as VerifyResult
		);
		// bits-ui leaves `pointer-events: none` on <body> after a dialog; tests share one document.
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		renderManager();

		await user.click(await screen.findByRole('button', { name: 'Add phone number' }));
		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).getByText(/Reply STOP to opt out/)).toBeInTheDocument();

		await user.type(within(dialog).getByLabelText('Mobile number'), '+1 (555) 123-4567');
		await user.click(within(dialog).getByRole('button', { name: 'Send code' }));

		await waitFor(() => expect(smsRequestCode).toHaveBeenCalled());
		expect(vi.mocked(smsRequestCode).mock.calls[0][0]).toMatchObject({
			body: { phone_number: '+15551234567' }
		});

		await user.type(await within(dialog).findByLabelText('Verification code'), '123 456');
		// The component refetches the status after verifying; the backend would now report verified.
		vi.mocked(smsStatus).mockResolvedValue(
			ok({
				phone_number: '+1••••••4567',
				verified: true,
				pending_verification: false
			}) as StatusResult
		);
		await user.click(within(dialog).getByRole('button', { name: 'Verify' }));

		await waitFor(() => expect(smsVerify).toHaveBeenCalled());
		expect(vi.mocked(smsVerify).mock.calls[0][0]).toMatchObject({ body: { code: '123456' } });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(await screen.findByText('Verified number: +1••••••4567')).toBeInTheDocument();
	});

	it('rejects a non-international number before calling the API', async () => {
		// bits-ui leaves `pointer-events: none` on <body> after a dialog; tests share one document.
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		renderManager();

		await user.click(await screen.findByRole('button', { name: 'Add phone number' }));
		const dialog = await screen.findByRole('dialog');
		await user.type(within(dialog).getByLabelText('Mobile number'), '555-1234');
		await user.click(within(dialog).getByRole('button', { name: 'Send code' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('International format');
		expect(smsRequestCode).not.toHaveBeenCalled();
	});

	it('keeps the dialog open and shows the backend detail when the code is rejected', async () => {
		vi.mocked(smsRequestCode).mockResolvedValue(
			ok({ message: 'sent' }) as unknown as RequestResult
		);
		vi.mocked(smsVerify).mockResolvedValue(fail('Incorrect code.') as unknown as VerifyResult);
		// bits-ui leaves `pointer-events: none` on <body> after a dialog; tests share one document.
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		renderManager();

		await user.click(await screen.findByRole('button', { name: 'Add phone number' }));
		const dialog = await screen.findByRole('dialog');
		await user.type(within(dialog).getByLabelText('Mobile number'), '+15551234567');
		await user.click(within(dialog).getByRole('button', { name: 'Send code' }));
		await user.type(await within(dialog).findByLabelText('Verification code'), '000000');
		await user.click(within(dialog).getByRole('button', { name: 'Verify' }));

		await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect code.'));
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('shows the verified state and removes the number on confirm', async () => {
		vi.mocked(smsStatus).mockResolvedValue(
			ok({
				phone_number: '+1••••••4567',
				verified: true,
				pending_verification: false
			}) as StatusResult
		);
		vi.mocked(smsRemovePhone).mockResolvedValue(
			ok(undefined) as unknown as Awaited<ReturnType<typeof smsRemovePhone>>
		);
		// bits-ui leaves `pointer-events: none` on <body> after a dialog; tests share one document.
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		renderManager();

		expect(await screen.findByText('Verified number: +1••••••4567')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Remove' }));
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

		await waitFor(() => expect(smsRemovePhone).toHaveBeenCalled());
	});
});
