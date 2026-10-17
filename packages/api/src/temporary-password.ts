/** Days a temporary password stays usable before the admin must issue a new one. */
export const TEMPORARY_PASSWORD_DAYS = 7;

export const temporaryPasswordExpiry = (now: Date) =>
  new Date(now.getTime() + TEMPORARY_PASSWORD_DAYS * 24 * 60 * 60 * 1000).toISOString();
