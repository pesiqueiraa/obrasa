import { describe, expect, it } from "vitest";
import { diferenca, leValor, limites, noMes } from "./contas";

describe("leValor", () => {
  it("lê o formato brasileiro e o com ponto decimal", () => {
    expect(leValor("2.000")).toBe(2000);
    expect(leValor("2.000,50")).toBe(2000.5);
    expect(leValor("1.234.567,8")).toBe(1234567.8);
    expect(leValor("2000.5")).toBe(2000.5);
    expect(leValor("R$ 350")).toBe(350);
  });
  it("recusa vazio", () => {
    expect(leValor("")).toBeNull();
    expect(leValor("abc")).toBeNull();
  });
});

describe("noMes", () => {
  const pts: [string, number][] = [
    ["2025-07-01", 1],
    ["2025-10-01", 2],
    ["2026-01-01", 3],
  ];
  it("pega o último dado publicado até o fim do mês", () => {
    expect(noMes(pts, "2025-12")).toEqual(["2025-10-01", 2]);
    expect(noMes(pts, "2026-01")).toEqual(["2026-01-01", 3]);
  });
  it("antes do primeiro dado, nada", () => {
    expect(noMes(pts, "2025-06")).toBeNull();
  });
});

describe("diferenca", () => {
  it("taxa em pontos percentuais", () => {
    expect(diferenca({ tipo: "taxa", unidade: "%", casas: 2 }, 5.17, 4.58)).toEqual({ seta: "↓", texto: "0,59 p.p." });
  });
  it("nível em %", () => {
    expect(diferenca({ tipo: "nivel", unidade: "R$", casas: 0 }, 3660, 3790)).toEqual({ seta: "↑", texto: "3,6%" });
  });
  it("igual", () => {
    expect(diferenca({ tipo: "taxa", unidade: "%", casas: 1 }, 4.9, 4.9).seta).toBe("=");
  });
});

describe("limites", () => {
  it("5 faixas iguais entre o menor e o maior, arredondadas", () => {
    expect(limites([2.1, 9.8, 5], 1)).toEqual([2.1, 3.6, 5.2, 6.7, 8.3, 9.8]);
  });
});
