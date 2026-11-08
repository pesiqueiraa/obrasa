// Valores reais (regra 3): série em reais correntes corrigida pelo número-índice do IPCA,
// a preços do mês-base. Conta determinística sobre valores do banco, como a calculadora.

export type Ponto = { refDate: string; value: number };

/**
 * Corrige `obs` (reais correntes) para preços de `base` (AAAA-MM-DD). Sem `base`, usa o
 * último mês que existe nas duas séries. Meses sem índice ficam de fora.
 */
export function corrige(obs: Ponto[], indice: [string, number][], base?: string): { pontos: Ponto[]; base: string } {
  const porMes = new Map(indice);
  const comIndice = obs.filter((o) => porMes.has(o.refDate.slice(0, 7)));
  if (comIndice.length === 0) throw new Error("série sem mês em comum com o IPCA");
  const b = base ?? comIndice.at(-1)!.refDate;
  const ib = porMes.get(b.slice(0, 7));
  if (ib === undefined) throw new Error(`IPCA sem o mês-base ${b}`);
  return {
    base: b,
    pontos: comIndice
      .filter((o) => o.refDate <= b)
      .map((o) => ({ refDate: o.refDate, value: (o.value * ib) / porMes.get(o.refDate.slice(0, 7))! })),
  };
}
