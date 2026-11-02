// Gera src/styles/tokens.css a partir do front matter do DESIGN.md (raiz do repositório).
// Uso: pnpm tokens         (escreve o arquivo)
//      pnpm tokens --check (falha se o arquivo estiver desatualizado; usado no CI)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const designPath = join(here, "../../../DESIGN.md");
const outPath = join(here, "../src/styles/tokens.css");

const source = readFileSync(designPath, "utf8");
const match = source.match(/^---\n([\s\S]*?)\n---\n/);
if (!match) throw new Error("DESIGN.md sem front matter YAML");
const design = parse(match[1]);

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const lines = [];
for (const [name, value] of Object.entries(design.colors)) lines.push(`  --bd-color-${name}: ${value};`);
for (const [name, value] of Object.entries(design.spacing)) lines.push(`  --bd-space-${name}: ${value};`);
for (const [name, value] of Object.entries(design.rounded)) lines.push(`  --bd-radius-${name}: ${value};`);
for (const [name, props] of Object.entries(design.typography)) {
  for (const [prop, value] of Object.entries(props)) {
    const v = prop === "fontFamily" ? `"${value}", "Helvetica Neue", Arial, sans-serif` : value;
    lines.push(`  --bd-type-${name}-${kebab(prop)}: ${v};`);
  }
}

const css = `/* Gerado por scripts/design-tokens.mjs a partir do DESIGN.md. Não edite à mão. */
:root {
${lines.join("\n")}
}
`;

if (process.argv.includes("--check")) {
  const current = readFileSync(outPath, "utf8");
  if (current !== css) {
    console.error("src/styles/tokens.css está desatualizado. Rode: pnpm --filter @brasilado/web tokens");
    process.exit(1);
  }
  console.log("tokens.css em dia com o DESIGN.md");
} else {
  writeFileSync(outPath, css);
  console.log(`escrito ${outPath} (${lines.length} tokens)`);
}
