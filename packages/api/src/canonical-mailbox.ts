/** Abuse-budget identity for validated emails; never use this as a delivery address. */
export function canonicalMailbox(email: string): string {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  let local = normalized.slice(0, separator).split("+")[0]!;
  let domain = normalized.slice(separator + 1).replace(/\.$/, "");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}
