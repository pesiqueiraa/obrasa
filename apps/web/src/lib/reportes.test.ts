import { describe, expect, it } from "vitest";
import { TEMPO_MINIMO_MS, valida } from "./reportes";

const agora = 1_800_000_000_000;

function form(campos: Record<string, string>) {
  const f = new FormData();
  const base = { aberto_em: String(agora - 60_000), descricao: "O IPCA de setembro está diferente do IBGE.", site: "" };
  for (const [k, v] of Object.entries({ ...base, ...campos })) f.set(k, v);
  return f;
}

describe("valida reporte", () => {
  it("aceita reporte só com a descrição", () => {
    const v = valida(form({}), agora);
    expect(v).toEqual({
      ok: true,
      dados: { pagina: "", descricao: "O IPCA de setembro está diferente do IBGE.", fonte: "" },
    });
  });

  it("recusa robô: campo isca, envio rápido ou sem hora de abertura", () => {
    expect(valida(form({ site: "http://spam" }), agora)).toMatchObject({ ok: false, robo: true });
    expect(valida(form({ aberto_em: String(agora - TEMPO_MINIMO_MS + 1) }), agora)).toMatchObject({ robo: true });
    expect(valida(form({ aberto_em: "" }), agora)).toMatchObject({ robo: true });
  });

  it("aponta o campo com problema", () => {
    expect(valida(form({ descricao: "curto" }), agora)).toMatchObject({ ok: false, campo: "descricao" });
    expect(valida(form({ descricao: "x".repeat(2001) }), agora)).toMatchObject({ campo: "descricao" });
    expect(valida(form({ fonte: "ibge.gov.br" }), agora)).toMatchObject({ campo: "fonte" });
    expect(valida(form({ fonte: "javascript:alert(1)" }), agora)).toMatchObject({ campo: "fonte" });
    expect(valida(form({ pagina: "p".repeat(301) }), agora)).toMatchObject({ campo: "pagina" });
  });

  it("aceita link da fonte com https", () => {
    const v = valida(form({ fonte: "https://sidra.ibge.gov.br/tabela/1737" }), agora);
    expect(v.ok).toBe(true);
  });
});
