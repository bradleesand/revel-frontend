import type { PageLoad } from './$types';

// Opened from a text message by someone with no account: the code in the URL is the
// credential, so render client-side like the email confirm-action page does.
export const ssr = false;

export const load: PageLoad = ({ params }) => {
	return { code: params.code };
};
