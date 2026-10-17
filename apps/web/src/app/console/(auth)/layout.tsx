import { EditorialType } from "@/components/brand/editorial-type";
import { ConsoleTheme } from "@/components/console/console-theme";
import { consoleViewport } from "@/components/console/console-viewport";

export const viewport = consoleViewport;

export default function ConsoleAuthLayout({ children }: LayoutProps<"/console">) {
  return (
    <EditorialType>
      <ConsoleTheme />
      {children}
    </EditorialType>
  );
}
