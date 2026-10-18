/**
 * A form rendered on the server can be submitted before React takes it over: on a slow phone or
 * desk PC the page shows for seconds before its scripts run. The browser would then submit it
 * natively — a GET to the same page, with every field in the URL (the password too, into the
 * history and any access log) — and reload it empty. This listener, inlined in the document head,
 * holds such a submission instead; `<Form>` sends it again once the page is interactive.
 */

/** Marks the forms the listener holds; `<Form>` renders it. */
export const EARLY_SUBMIT_ATTRIBUTE = "data-early-submit";
/** Set on the form element by `<Form>` once React handles its submissions. */
export const READY_KEY = "avantiFormReady";
/** The held submission's submitter (the button pressed), or null when submitted with Enter. */
export const PENDING_KEY = "avantiPendingSubmit";

export type EarlySubmitForm = HTMLFormElement & {
  [READY_KEY]?: true;
  [PENDING_KEY]?: HTMLElement | null;
};

// Capture on window: it runs before React's own listener on the root, and is plain ES5 so it
// works on whatever browser the page reaches before the bundle does.
export const EARLY_SUBMIT_SCRIPT =
  `addEventListener("submit",function(e){var f=e.target;` +
  `if(f&&f.hasAttribute&&f.hasAttribute("${EARLY_SUBMIT_ATTRIBUTE}")&&!f.${READY_KEY}){` +
  `e.preventDefault();f.${PENDING_KEY}=e.submitter||null}},true);`;
