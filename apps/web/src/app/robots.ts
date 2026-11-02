// /robots.txt: buscadores podem ler todo o site, menos o vigia da esteira (/saude).

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/saude"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
