import { describe, expect, it } from "vitest";
import { tokenConfere, urlDoIbge } from "./ponte";

const TOKEN = "x".repeat(40);

describe("ponte do IBGE", () => {
  it("fechada sem token configurado, com token curto ou diferente", () => {
    expect(tokenConfere(TOKEN, undefined)).toBe(false);
    expect(tokenConfere("curto", "curto")).toBe(false);
    expect(tokenConfere(null, TOKEN)).toBe(false);
    expect(tokenConfere("y".repeat(40), TOKEN)).toBe(false);
    expect(tokenConfere(TOKEN, TOKEN)).toBe(true);
  });

  it("monta a URL do IBGE com a query original", () => {
    const url = urlDoIbge(["v3", "agregados", "1737", "periodos", "-12", "variaveis", "63|2266"], "?localidades=N1[all]");
    expect(url?.href.startsWith("https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/-12/")).toBe(true);
    expect(url?.search).toContain("localidades=");
  });

  it("recusa caminho que sai do IBGE ou tem caractere estranho", () => {
    expect(urlDoIbge([], "")).toBeNull();
    expect(urlDoIbge(["..", "x"], "")).toBeNull();
    expect(urlDoIbge(["v3", "a/b"], "")).toBeNull();
    expect(urlDoIbge(["@evil.com"], "")).toBeNull();
    expect(urlDoIbge(["v3", "%2e%2e"], "")).toBeNull();
  });
});
