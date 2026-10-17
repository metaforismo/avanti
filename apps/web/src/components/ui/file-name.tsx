import { cn } from "@/lib/cn";

/**
 * A file name on one line that, when too long, cuts the middle of the name and keeps the
 * extension: "IMG_2025…edited.HEIC" tells files apart, "IMG_20250914_18…" does not.
 */
export function FileName({ name, className }: { name: string; className?: string }) {
  const dot = name.lastIndexOf(".");
  const hasExtension = dot > 0 && name.length - dot <= 6;
  const stem = hasExtension ? name.slice(0, dot) : name;
  const extension = hasExtension ? name.slice(dot) : "";
  return (
    <span className={cn("flex min-w-0", className)} title={name} dir="auto">
      <span className="min-w-0 truncate">{stem}</span>
      {extension && <span className="shrink-0">{extension}</span>}
    </span>
  );
}
