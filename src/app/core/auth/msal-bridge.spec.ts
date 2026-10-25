import { relayedAuthResponse } from './msal-bridge';

/** A window as the check reads it: who opened it, who frames it, where it is, and how it closes. */
function windowAt(href: string, how: 'top' | 'popup' | 'frame'): Window {
  const win = {
    location: { href },
    opener: null as unknown,
    parent: null as unknown,
    close: vi.fn(),
  };
  win.parent = how === 'frame' ? {} : win;
  win.opener = how === 'popup' ? {} : null;
  return win as unknown as Window;
}

/**
 * MSAL v5 needs the page a popup or silent iframe lands on to hand the answer back to the main
 * window; the app must not boot there. Everything else boots as before, the full-page sign-in
 * redirect included.
 */
describe('relayedAuthResponse', () => {
  const answer = 'https://app.test/#code=abc&state=xyz';

  it('relays an auth answer landing in a popup — the app does not boot there', () => {
    expect(relayedAuthResponse(windowAt(answer, 'popup'))).toBe(true);
  });

  it('relays one landing in a silent iframe, an error answer too', () => {
    expect(relayedAuthResponse(windowAt('https://app.test/?error=x&state=y', 'frame'))).toBe(true);
  });

  it('boots normally on a full-page sign-in redirect — handleRedirectPromise finishes it', () => {
    expect(relayedAuthResponse(windowAt(answer, 'top'))).toBe(false);
  });

  it('boots normally in a popup or frame that carries no auth answer', () => {
    expect(relayedAuthResponse(windowAt('https://app.test/projects', 'popup'))).toBe(false);
    expect(relayedAuthResponse(windowAt('https://app.test/?code=only', 'frame'))).toBe(false);
  });
});
