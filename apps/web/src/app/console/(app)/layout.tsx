import type { Metadata } from "next";
import { ConsoleShell } from "@/components/console/console-shell";
import { EditorialType } from "@/components/brand/editorial-type";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s · Console Avanti" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConsoleLayout({ children }: LayoutProps<"/console">) {
  return (
    <EditorialType>
      <ConsoleShell>{children}</ConsoleShell>
    </EditorialType>
  );
}
