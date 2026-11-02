import { EditorialType } from "@/components/brand/editorial-type";
import { MobileCta } from "@/components/landing/mobile-cta";
import { RevealScan } from "@/components/landing/reveal-scan";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import "./site.css";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <EditorialType>
      <div className="site contents">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-contrast focus:px-4 focus:py-2 focus:text-on-contrast"
        >
          Vai al contenuto
        </a>
        <SiteHeader />
        <main id="contenuto">{children}</main>
        <SiteFooter />
        <MobileCta />
        <RevealScan />
      </div>
    </EditorialType>
  );
}
