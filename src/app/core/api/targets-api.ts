/**
 * Is this request going to the engine? Compared as a resolved origin plus a path prefix, never as
 * raw text: a `startsWith` would hand credentials to `api.test.evil.example`, or to `/apidocs`
 * when the base is `/api`. A URL that will not parse is treated as not-the-engine.
 */
export function targetsApi(url: string, baseUrl: string, documentBase: string): boolean {
  let target: URL;
  let base: URL;
  try {
    target = new URL(url, documentBase);
    base = new URL(baseUrl, documentBase);
  } catch {
    return false;
  }
  if (target.origin !== base.origin) return false;

  const prefix = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  return target.pathname === base.pathname || target.pathname.startsWith(prefix);
}
