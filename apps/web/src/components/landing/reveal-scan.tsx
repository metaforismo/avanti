"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startReveals } from "@/lib/site/reveal";

/** Starts the scroll reveals of each site page, after it has hydrated. */
export function RevealScan() {
  const pathname = usePathname();
  useEffect(() => startReveals(), [pathname]);
  return null;
}
