import { EditorialType } from "@/components/brand/editorial-type";
import { ConsoleTheme } from "@/components/console/console-theme";

export default function ConsoleAuthLayout({ children }: LayoutProps<"/console">) {
  return (
    <EditorialType>
      <ConsoleTheme />
      {children}
    </EditorialType>
  );
}
