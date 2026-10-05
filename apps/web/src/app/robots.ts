import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // Citizen links and the console must never be indexed.
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy"],
      disallow: ["/api/", "/console", "/pratica/", "/s/", "/stampa/"],
    },
    sitemap: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3400"}/sitemap.xml`,
  };
}
