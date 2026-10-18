/**
 * «Esci» on a desk PC shared by colleagues must also close the console's other tabs, the print
 * sheet above all: it stays open on screen with names and documents. BroadcastChannel reaches the
 * other tabs of this browser profile; the `storage` event is the fallback where it is missing.
 * Only a marker crosses tabs, never who signed out, and the key is removed at once.
 */
const CHANNEL = "avanti-console-session";
const KEY = "avanti:console-signed-out";
const SIGNED_OUT = "signed-out";
// A channel also hears other channels of its own tab: this tab ignores what it announced itself.
const TAB = Math.random().toString(36).slice(2);

export function announceSignOut() {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: SIGNED_OUT, from: TAB });
    channel.close();
  } catch {
    // No BroadcastChannel: the storage event below still reaches the other tabs.
  }
  try {
    localStorage.setItem(KEY, String(Date.now()));
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the other tabs notice at their next request or when shown again.
  }
}

/** Calls back when another tab signed out; may call twice (both channels), so keep it idempotent. */
export function onSignOutElsewhere(callback: () => void) {
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<{ type?: unknown; from?: unknown }>) => {
      if (event.data?.type === SIGNED_OUT && event.data.from !== TAB) callback();
    };
  } catch {
    channel = null;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY && event.newValue) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}
