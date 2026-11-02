// Testes no navegador, num celular emulado (Chromium com toque): o site cabe na tela,
// os alvos de toque têm 48px e as interações que no desktop são de mouse funcionam com
// o dedo (DESIGN.md, "Responsive Behavior").
//
// Uso, com o banco local de pé e coletado (README, "Desenvolvimento"):
//   pnpm test:e2e                     # sobe o `pnpm dev` se nada responder na porta 3000
//   SITE_URL=http://localhost:3000 pnpm test:e2e
//
// Arquivos *.e2e.ts, para o Vitest (`pnpm test`) não os pegar.

import { defineConfig, devices } from "@playwright/test";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 120_000, // a primeira visita a uma página no `pnpm dev` compila a página
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: SITE },
  projects: [
    { name: "celular-375", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 800 } } },
    { name: "celular-320", use: { ...devices["iPhone SE"], browserName: "chromium", viewport: { width: 320, height: 640 } } },
  ],
  webServer: {
    command: "pnpm dev",
    url: SITE,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
