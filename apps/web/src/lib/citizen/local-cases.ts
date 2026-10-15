/**
 * Remembers the last case token per office on this device, so a citizen who scans the
 * office QR again can resume instead of starting over. Storage may be unavailable
 * (private mode, blocked cookies): every access is best effort.
 *
 * The token opens the case, so a phone passed to a relative or a tablet in the waiting room
 * must not keep it forever: it is forgotten after 30 days, and as soon as someone chooses to
 * start a new case at that office.
 */
const key = (officeSlug: string) => `avanti:case:${officeSlug}`;
export const REMEMBER_DAYS = 30;

export function rememberCase(officeSlug: string, token: string, now = Date.now()) {
  try {
    localStorage.setItem(key(officeSlug), JSON.stringify({ token, savedAt: now }));
  } catch {}
}

export function recallCase(officeSlug: string, now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(key(officeSlug));
    if (!raw) return null;
    let saved: unknown = null;
    try {
      saved = JSON.parse(raw);
    } catch {}
    if (
      saved &&
      typeof saved === "object" &&
      "token" in saved &&
      typeof saved.token === "string" &&
      "savedAt" in saved &&
      typeof saved.savedAt === "number" &&
      now - saved.savedAt < REMEMBER_DAYS * 86_400_000
    )
      return saved.token;
    // Expired, or written by an older version without a date: forget it.
    localStorage.removeItem(key(officeSlug));
    return null;
  } catch {
    return null;
  }
}

export function forgetCase(officeSlug: string) {
  try {
    localStorage.removeItem(key(officeSlug));
  } catch {}
}

export function forgetCaseToken(token: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith("avanti:case:")) continue;
      const raw = localStorage.getItem(k) ?? "";
      if (raw === token || raw.includes(`"token":${JSON.stringify(token)}`))
        localStorage.removeItem(k);
    }
  } catch {}
}
