"use client";

import { useEffect } from "react";

/**
 * Scope for the console's dark theme (see globals.css): citizen pages and the site stay light.
 * Also on the sign-in page, so a dark-mode operator doesn't go from a white page to a dark one.
 */
export function ConsoleTheme() {
  useEffect(() => {
    document.documentElement.classList.add("console");
    return () => document.documentElement.classList.remove("console");
  }, []);
  // Server-rendered marker: globals.css switches theme on it with :has() before hydration.
  return <span data-console-theme hidden />;
}
