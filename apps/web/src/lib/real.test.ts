import { describe, expect, it } from "vitest";
import { corrige } from "./real";

const indice: [string, number][] = [
  ["2025-01", 100],
  ["2025-02", 102],
  ["2025-03", 105],
];

describe("corrige", () => {
  it("leva cada mês a preços do último mês com índice", () => {
    const { pontos, base } = corrige(
      [
        { refDate: "2025-01-01", value: 10 },
        { refDate: "2025-03-01", value: 10 },
      ],
      indice,
    );
    expect(base).toBe("2025-03-01");
    expect(pontos).toEqual([
      { refDate: "2025-01-01", value: 10.5 },
      { refDate: "2025-03-01", value: 10 },
    ]);
  });

  it("aceita mês-base explícito e corta o que vem depois", () => {
    const { pontos } = corrige(
      [
        { refDate: "2025-01-01", value: 100 },
        { refDate: "2025-02-01", value: 100 },
        { refDate: "2025-03-01", value: 100 },
      ],
      indice,
      "2025-02-01",
    );
    expect(pontos.map((p) => p.value)).toEqual([102, 100]);
  });

  it("deixa de fora mês sem índice e falha sem mês em comum", () => {
    expect(
      corrige(
        [
          { refDate: "2025-04-01", value: 1 },
          { refDate: "2025-01-01", value: 1 },
        ],
        indice,
      ).pontos,
    ).toHaveLength(1);
    expect(() => corrige([{ refDate: "2024-01-01", value: 1 }], indice)).toThrow();
  });
});
