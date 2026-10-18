/** API path of a citizen case. Shared by the page's preload and the client fetch, which must match. */
export const casePath = (token: string) => `/api/c/${encodeURIComponent(token)}`;

/**
 * Whether the browser hands a `<link rel="preload" as="fetch">` to the page's matching fetch().
 * Chromium does; WebKit (every browser on iOS) does not yet, and the case is `no-store`, so
 * there the preload would download the case a second time on the slowest connections. Firefox
 * is left out until measured. A wrong guess only costs the preload's head start.
 */
export function reusesFetchPreload(userAgent: string | null): boolean {
  if (!userAgent) return false;
  if (/iPhone|iPad|iPod|CriOS|EdgiOS|FxiOS/.test(userAgent)) return false;
  return /\bChrom(e|ium)\/\d/.test(userAgent);
}
