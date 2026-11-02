import { join } from "node:path";
import type { NextConfig } from "next";

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
    "/**": ["../../config/templates/**", "../../config/regional.yaml"],
    // Fontes .woff da imagem de compartilhamento de cada indicador.
    "/indicador/**": ["./assets/og/**"],
  },
};

export default nextConfig;
