"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
import {
  EARLY_SUBMIT_ATTRIBUTE,
  PENDING_KEY,
  READY_KEY,
  type EarlySubmitForm,
} from "@/lib/early-submit";

/**
 * A `<form>` for pages rendered on the server: a submission made before hydration is held by the
 * head script (see lib/early-submit) and sent again here, with what the person typed meanwhile.
 * Its fields must be uncontrolled, or read from the DOM on submit: before hydration only the DOM
 * knows what was typed.
 *
 * POST by default: if the script never runs (JavaScript off, blocked by a stricter CSP, an
 * extension) the browser's own submission carries the fields in the body, never in the URL. Next
 * renders the page again for a POST without a server action, ignoring the body.
 */
export function Form(props: Omit<ComponentProps<"form">, "ref">) {
  const own = useRef<HTMLFormElement>(null);
  // A layout effect runs in the commit that attaches React's handlers: no event can fall
  // between the two, so a submission is never held once React would have handled it.
  useLayoutEffect(() => {
    const form = own.current as EarlySubmitForm | null;
    if (!form) return;
    form[READY_KEY] = true;
    if (!(PENDING_KEY in form)) return;
    const submitter = form[PENDING_KEY];
    delete form[PENDING_KEY];
    // After the commit, so the handler sees this render's state.
    queueMicrotask(() => {
      if (!form.isConnected) return;
      const button =
        (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) &&
        submitter.form === form &&
        submitter.type === "submit"
          ? submitter
          : null;
      // A button that became disabled meanwhile would not submit on a click either.
      if (button?.disabled) return;
      form.requestSubmit(button ?? undefined);
    });
  }, []);
  return <form method="post" {...props} {...{ [EARLY_SUBMIT_ATTRIBUTE]: "" }} ref={own} />;
}
