/**
 * Tiny client-side checks. The server validates everything again with the zod contracts;
 * these only exist to give instant feedback without shipping zod to the browser.
 */

// Same shape the server accepts: something@something.tld, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmail = (value: string) => value.length <= 200 && EMAIL.test(value);

export const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";
