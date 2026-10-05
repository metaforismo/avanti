export type ErrorRecord = {
  requestId: string;
  name: string;
  code: string | null;
  stack: string | null;
};
export function safeError(error: unknown): Omit<ErrorRecord, "requestId"> {
  const value = error instanceof Error ? error : null;
  const code = value && "code" in value && typeof value.code === "string" ? value.code : null;
  const header = value ? `${value.name}${value.message ? `: ${value.message}` : ""}` : "";
  const frames = value?.stack?.startsWith(header) ? value.stack.slice(header.length) : null;
  return {
    name: value && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value.name) ? value.name : "Error",
    code: code && /^[A-Z0-9_]{1,40}$/.test(code) ? code : null,
    stack:
      frames
        ?.split("\n")
        .filter((line) => /^\s+at /.test(line))
        .join("\n") ?? null,
  };
}
