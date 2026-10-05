import type { Route } from "next";

/** Only same-app console paths are allowed as post-login destinations (no open redirect). */
export function safeNext(value: string | null): Route {
  if (value && /^\/console(\/|\?|$)/.test(value) && !value.includes("\\")) return value as Route;
  return "/console";
}
