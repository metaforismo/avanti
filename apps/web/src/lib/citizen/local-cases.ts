/**
 * Remembers the last case token per office on this device, so a citizen who scans the
 * office QR again can resume instead of starting over. Storage may be unavailable
 * (private mode, blocked cookies): every access is best effort.
 */
const key = (officeSlug: string) => `avanti:case:${officeSlug}`;

export function rememberCase(officeSlug: string, token: string) {
  try {
    localStorage.setItem(key(officeSlug), token);
  } catch {}
}

export function recallCase(officeSlug: string): string | null {
  try {
    return localStorage.getItem(key(officeSlug));
  } catch {
    return null;
  }
}

export function forgetCaseToken(token: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("avanti:case:") && localStorage.getItem(k) === token) localStorage.removeItem(k);
    }
  } catch {}
}
