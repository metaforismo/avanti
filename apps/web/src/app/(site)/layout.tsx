import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { EditorialType } from "@/components/brand/editorial-type";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <EditorialType>
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Vai al contenuto
      </a>
      <SiteHeader />
      <main id="contenuto">{children}</main>
      <SiteFooter />
    </EditorialType>
  );
}
