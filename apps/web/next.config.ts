import { join } from "node:path";
import type { NextConfig } from "next";
import { cabecalhosDeSeguranca } from "./src/lib/seguranca";

const repoRoot = join(__dirname, "../..");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Monorepo: o Next precisa enxergar config/templates (frases versionadas).
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Avisos de depreciação do Sass vêm do código do Carbon, não do nosso.
  sassOptions: { quietDeps: true, silenceDeprecations: ["if-function"] },
  outputFileTracingIncludes: {
    "/**": ["../../config/templates/**", "../../config/regional.yaml", "../../config/saude.yaml"],
    // Fontes .woff da imagem de compartilhamento de cada indicador.
    "/indicador/**": ["./assets/og/**"],
  },
  poweredByHeader: false,
  // CSP e demais cabeçalhos em todas as respostas (src/lib/seguranca.ts).
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca(process.env.NODE_ENV !== "production") }];
  },
};

export default nextConfig;
