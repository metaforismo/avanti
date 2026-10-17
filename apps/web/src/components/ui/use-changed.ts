import { useState } from "react";

/**
 * True once `value` differs from what it was on mount. Lets a state change animate (a badge that
 * turns "verified") without every badge animating when the page first renders.
 */
export function useChanged(value: unknown) {
  const [previous, setPrevious] = useState(value);
  const [changed, setChanged] = useState(false);
  if (!Object.is(value, previous)) {
    setPrevious(value);
    setChanged(true);
  }
  return changed;
}
