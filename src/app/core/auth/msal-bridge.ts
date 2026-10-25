/**
 * THE PAGE A POPUP OR SILENT IFRAME LANDS ON — handed straight back to the window that opened it.
 *
 * MSAL v5 no longer reads a popup's or iframe's URL from the main window: the main window listens
 * on a BroadcastChannel, and the page Entra redirects to must post the response there
 * (`broadcastResponseToMainFrame`, its "redirect bridge"). The redirect URI is the app's root, so
 * without this a silent renewal's iframe would boot the whole application, never broadcast, and
 * the main window would wait until it timed out.
 *
 * So `main.ts` asks first: is this load an auth response inside a popup or a frame? Then the
 * bridge — a lazy chunk, fetched only here — answers it and closes the window, and the app does
 * not boot. A full-page sign-in redirect has no opener and no parent, so it still boots and
 * finishes in `handleRedirectPromise`.
 */
export function relayedAuthResponse(win: Window): boolean {
  const framed = (win.opener !== null && win.opener !== win) || win.parent !== win;
  const href = win.location.href;
  if (!framed || !/[?#&](code|error)=/.test(href) || !/[?#&]state=/.test(href)) return false;
  void import('@azure/msal-browser/redirect-bridge')
    .then((bridge) => bridge.broadcastResponseToMainFrame())
    .catch(() => win.close());
  return true;
}
