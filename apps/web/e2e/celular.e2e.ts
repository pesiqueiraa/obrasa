// O site no celular (DESIGN.md, "Responsive Behavior"): cabe na tela, todo controle tem
// alvo de toque de 48px, campo de texto não dispara o zoom do iPhone, e o que no desktop
// é de mouse (dica do mapa, destaque da bancada) funciona com o dedo.

import { expect, test, type Page } from "@playwright/test";

const ROTAS = [
  "/",
  "/economia",
  "/trabalho",
  "/contas-publicas",
  "/educacao",
  "/eleicoes-2026",
  "/noticias",
  "/indicador/ipca-12-meses",
  "/indicador/selic",
  "/calculadora",
  "/comparar",
  "/agenda",
  "/metodologia",
  "/metodologia/ipca-12-meses",
  "/correcoes",
  "/reportar-erro",
  "/privacidade",
];

async function abre(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "networkidle" });
}

for (const rota of ROTAS) {
  test(`${rota}: cabe na tela, alvos de 48px, campos de 16px`, async ({ page }) => {
    await abre(page, rota);
    const r = await page.evaluate(() => {
      const visivel = (el: Element) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return false;
        if (el.closest("[aria-hidden=true], .visually-hidden, .cds--visually-hidden, .skip-link")) return false;
        return getComputedStyle(el).visibility !== "hidden";
      };
      // Link no meio de uma frase é isento (WCAG 2.5.8): é inline e o bloco em volta tem
      // mais texto que ele.
      const dentroDeFrase = (a: Element) => {
        if (getComputedStyle(a).display !== "inline") return false;
        let bloco = a.parentElement;
        while (bloco && getComputedStyle(bloco).display.startsWith("inline")) bloco = bloco.parentElement;
        const texto = (bloco?.textContent ?? "").replace(/\s+/g, " ").trim();
        return texto.length > (a.textContent ?? "").replace(/\s+/g, " ").trim().length + 2;
      };
      // Título de cartão cujo ::after cobre o cartão inteiro (stretched link).
      const cobreCartao = (a: Element) => getComputedStyle(a, "::after").position === "absolute";
      const pequenos: string[] = [];
      for (const el of document.querySelectorAll("a[href], button, select, textarea, input, summary, [role=tab]")) {
        if (!visivel(el)) continue;
        if (el.matches("input[type=radio], input[type=checkbox], input[type=hidden]")) continue;
        if (el.matches("a") && (dentroDeFrase(el) || cobreCartao(el))) continue;
        const rotulo = el.closest("label");
        const alvo = rotulo && rotulo.getBoundingClientRect().height >= 48 ? rotulo : el;
        const b = alvo.getBoundingClientRect();
        if (b.height < 47.5 || b.width < 24) {
          const nome = (el.textContent || el.getAttribute("aria-label") || el.tagName).replace(/\s+/g, " ").trim();
          pequenos.push(`${el.tagName.toLowerCase()} "${nome.slice(0, 40)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
        }
      }
      const camposPequenos = [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => visivel(el) && !el.matches("[type=radio], [type=checkbox], [type=range], [type=hidden]"))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => `${el.tagName.toLowerCase()}[name=${el.getAttribute("name")}]`);
      return {
        largura: document.documentElement.scrollWidth,
        tela: document.documentElement.clientWidth,
        pequenos,
        camposPequenos,
      };
    });
    expect(r.largura, "a página rola de lado").toBeLessThanOrEqual(r.tela);
    expect(r.pequenos, "alvos de toque abaixo de 48px").toEqual([]);
    expect(r.camposPequenos, "campo abaixo de 16px dá zoom no iPhone").toEqual([]);
  });
}

// O elemento está inteiro na largura da tela (o que importa numa faixa que rola de lado).
async function cabeNaLargura(page: Page, seletor: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const b = el.getBoundingClientRect();
      return b.left >= -0.5 && b.right <= document.documentElement.clientWidth + 0.5;
    });
  }, seletor);
}

test("menu de temas mostra o tema aberto, mesmo o último da lista", async ({ page }) => {
  for (const rota of ["/educacao", "/noticias"]) {
    await abre(page, rota);
    await expect.poll(() => cabeNaLargura(page, "nav[aria-label=Temas] [aria-current=page]")).toEqual([true]);
  }
});

test("cabeçalho sai ao rolar para baixo e volta ao rolar para cima", async ({ page }) => {
  await abre(page, "/economia");
  const fundo = () => page.evaluate(() => document.querySelector("header")!.getBoundingClientRect().bottom);
  await page.mouse.wheel(0, 800);
  await expect.poll(fundo).toBeLessThanOrEqual(0);
  await page.mouse.wheel(0, -300);
  await expect.poll(fundo).toBeGreaterThan(0);
});

test("gráfico Juros e inflação: texto com pelo menos 12px na tela", async ({ page }) => {
  await abre(page, "/economia");
  const menor = await page.evaluate(() => {
    const textos = [...document.querySelectorAll("figure svg[role=img] text")];
    return Math.min(...textos.map((t) => t.getBoundingClientRect().height));
  });
  // altura da caixa do texto ≈ 1,2 × o tamanho da fonte; 12px dá ~14px
  expect(menor).toBeGreaterThanOrEqual(12);
});

test("abas do gráfico do indicador cabem sem seta de rolar", async ({ page }) => {
  await abre(page, "/indicador/ipca-12-meses");
  const abas = await cabeNaLargura(page, "[role=tab]");
  expect(abas.length).toBeGreaterThan(1);
  expect(abas.every(Boolean)).toBe(true);
});

// Arrasta o dedo na horizontal sobre o elemento (eventos de toque de verdade, pelo CDP)
// e devolve o texto da leitura no começo e no fim do arraste.
async function arrasta(page: Page, alvo: string, leitura: string, de = 0.3, ate = 0.7, altura = 0.5) {
  const el = page.locator(alvo).first();
  await el.scrollIntoViewIfNeeded();
  const b = (await el.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = b.y + b.height * altura;
  const toque = (type: "touchStart" | "touchMove" | "touchEnd", f = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: b.x + b.width * f, y }] });
  const texto = () => page.locator(leitura).first().innerText();
  await toque("touchStart", de);
  await expect.poll(texto).not.toBe("");
  const inicio = await texto();
  for (let f = de; f <= ate; f += 0.04) await toque("touchMove", f);
  await toque("touchEnd");
  return { inicio, fim: await texto() };
}

test("gráfico do indicador: arrastar o dedo percorre a série", async ({ page }) => {
  await abre(page, "/indicador/ipca-12-meses");
  const { inicio, fim } = await arrasta(page, "[class*=leitura]", "[class*=leituraEtiqueta]");
  expect(inicio).toMatch(/^\w{3}\/\d{4}: [\d,]+%$/);
  expect(fim).toMatch(/^\w{3}\/\d{4}: [\d,]+%$/);
  expect(fim).not.toBe(inicio);
  // a leitura fica depois de soltar e some ao tocar fora
  await page.locator("h1").tap();
  await expect(page.locator("[class*=leituraEtiqueta]")).toHaveCount(0);
});

test("gráfico Juros e inflação: arrastar o dedo percorre os meses", async ({ page }) => {
  await abre(page, "/economia");
  const { inicio, fim } = await arrasta(page, "figure svg[role=img]", "[class*=leituraLinha]", 0.2, 0.5);
  expect(inicio).toContain("Selic");
  expect(fim).toContain("IPCA 12m");
  expect(fim).not.toBe(inicio);
});

test("minilinha do cartão: arrastar o dedo mostra período e valor", async ({ page }) => {
  await abre(page, "/economia");
  const el = page.locator("svg[aria-hidden=true][style*=crosshair]").first();
  await el.scrollIntoViewIfNeeded();
  const b = (await el.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width * 0.5, b.y + b.height / 2);
  await expect(page.locator("span[aria-hidden=true]").filter({ hasText: /\d{4}: / }).first()).toBeVisible();
});

test("mapa por estado: arrastar o dedo mostra estado, valor e posição", async ({ page }) => {
  await abre(page, "/trabalho");
  const { fim } = await arrasta(page, "svg:has(path[data-uf])", "[class*=mapaUf] [class*=leitura]", 0.45, 0.75, 0.55);
  expect(fim).toMatch(/: [\d,]+% · \d+º de 27$/);
});

test("mapa por município: tocar e arrastar mostram o município; tocar fora limpa", async ({ page }) => {
  await abre(page, "/eleicoes-2026");
  await page.waitForSelector("path[data-m]");
  const leitura = "[class*=leituraMun]";
  const { inicio, fim } = await arrasta(page, "svg:has(path[data-m])", leitura, 0.5, 0.8, 0.4);
  expect(inicio).toMatch(/\([A-Z]{2}\): [\d,]+% dos válidos/);
  expect(fim).toMatch(/\([A-Z]{2}\): [\d,]+% dos válidos/);
  expect(fim).not.toBe(inicio);
  // no toque não há dica flutuante (o dedo a cobriria): há um anel onde o dedo está
  await expect(page.locator("[role=status]").filter({ hasText: "dos válidos" })).toHaveCount(0);
  await expect(page.locator("[class*=alvoDedo]")).toBeVisible();
  await page.getByRole("heading", { name: "Por município" }).tap();
  await expect(page.locator(leitura)).toContainText("Passe o mouse ou o dedo");
});

test("bancada: tocar num partido destaca as cadeiras dele; tocar fora apaga", async ({ page }) => {
  await abre(page, "/eleicoes-2026");
  const partido = page.locator("button[aria-pressed]").first();
  await partido.scrollIntoViewIfNeeded();
  await partido.tap();
  await expect(partido).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("heading", { name: "Congresso eleito" }).tap();
  await expect(partido).toHaveAttribute("aria-pressed", "false");
});
