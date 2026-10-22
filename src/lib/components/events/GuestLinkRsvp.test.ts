import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import GuestLinkRsvp from './GuestLinkRsvp.svelte';
import {
	eventpublicguestlinkGetGuestLink,
	eventpublicguestlinkRsvp
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventpublicguestlinkGetGuestLink: vi.fn(),
	eventpublicguestlinkRsvp: vi.fn()
}));

type LinkResult = Awaited<ReturnType<typeof eventpublicguestlinkGetGuestLink>>;
type RsvpResult = Awaited<ReturnType<typeof eventpublicguestlinkRsvp>>;

function ok<T>(data: T, status = 200) {
	return { data, error: undefined, response: { ok: true, status } as Response };
}

function fail(detail: string, status: number) {
	return { data: undefined, error: { detail }, response: { ok: false, status } as Response };
}

const link = {
	code: 'Abc23Defgh',
	expires_at: '2026-12-10T00:00:00Z',
	display_name: 'Sam',
	phone_number_masked: '+1••••••0001',
	rsvp_status: null,
	can_rsvp: true,
	event: {
		id: '11111111-1111-1111-1111-111111111111',
		name: 'Midsummer Dinner Party',
		start: '2026-12-01T18:00:00Z',
		end: '2026-12-01T23:00:00Z',
		timezone: 'America/Los_Angeles',
		organization: { name: 'House Ego', slug: 'house-ego' },
		venue: { name: 'The Long Table' },
		city: null,
		requires_ticket: false
	}
};

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: { client, component: GuestLinkRsvp, componentProps: { code: link.code } }
	});
}

describe('GuestLinkRsvp', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(eventpublicguestlinkGetGuestLink).mockResolvedValue(
			ok(link) as unknown as LinkResult
		);
	});

	it('shows the event and records an answer', async () => {
		vi.mocked(eventpublicguestlinkRsvp).mockResolvedValue(
			ok({ event_id: link.event.id, status: 'yes', note: '' }) as unknown as RsvpResult
		);
		const user = userEvent.setup();
		renderPage();

		expect(
			await screen.findByRole('heading', { name: 'Midsummer Dinner Party' })
		).toBeInTheDocument();
		expect(screen.getByText('The Long Table')).toBeInTheDocument();
		expect(screen.getByText(/Invitation for Sam/)).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Yes' }));

		await waitFor(() => expect(eventpublicguestlinkRsvp).toHaveBeenCalled());
		expect(vi.mocked(eventpublicguestlinkRsvp).mock.calls[0][0]).toMatchObject({
			path: { code: link.code, answer: 'yes' }
		});
		expect(await screen.findByRole('status')).toHaveTextContent('your answer is saved');
		expect(screen.getByRole('button', { name: /Yes/ })).toHaveAttribute('aria-pressed', 'true');
	});

	it('hides the buttons when the event needs a ticket', async () => {
		vi.mocked(eventpublicguestlinkGetGuestLink).mockResolvedValue(
			ok({ ...link, can_rsvp: false }) as unknown as LinkResult
		);
		renderPage();

		expect(await screen.findByText(/needs a ticket/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
	});

	it('explains an expired link', async () => {
		vi.mocked(eventpublicguestlinkGetGuestLink).mockResolvedValue(
			fail('This link has expired.', 410) as unknown as LinkResult
		);
		renderPage();

		expect(await screen.findByRole('alert')).toHaveTextContent('expired');
	});

	it('explains an unknown link', async () => {
		vi.mocked(eventpublicguestlinkGetGuestLink).mockResolvedValue(
			fail('This link is not valid.', 404) as unknown as LinkResult
		);
		renderPage();

		expect(await screen.findByRole('alert')).toHaveTextContent("isn't valid");
	});

	it('shows the backend detail when saving fails', async () => {
		vi.mocked(eventpublicguestlinkRsvp).mockResolvedValue(
			fail('This event is full.', 400) as unknown as RsvpResult
		);
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole('button', { name: 'No' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('This event is full.');
	});
});
