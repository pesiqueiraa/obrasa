import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";
import {
  addMonths,
  formatDate,
  formatRef,
  formatRefLong,
  formatValue,
  monthShort,
  shiftMonths,
  todayInBrazil,
} from "./format";
import {
  chooseSeries,
  delayStatus,
  lastOfMonth,
  nextRelease,
  sliceWindow,
  variation,
  variationText,
  type Obs,
} from "./indicator";
import { frase, fraseAcumulado12m, inicioDoValorVigente, parseTemplate } from "./template";

function monthly(start: string, values: number[]): Obs[] {
  return values.map((value, i) => ({
    refDate: addMonths(start, i),
    value,
    revision: 0,
    collectedAt: "2026-11-02T01:31:35Z",
    rawObject: "storage://raw/x.json",
  }));
}

describe("formatação pt-BR", () => {
  it("usa vírgula decimal e % colado", () => {
    expect(formatValue(4.58, "%")).toBe("4,58%");
    expect(formatValue(1234.5, "R$ bilhões")).toBe("R$ 1.234,50 bilhões");
    expect(formatValue(13.75, "% a.a.")).toBe("13,75% a.a.");
    expect(formatValue(82.93, "% do PIB", 1)).toBe("82,9% do PIB");
    expect(formatValue(3811, "R$", 0)).toBe("R$ 3.811");
    expect(formatValue(5.4212, "R$/US$", 4)).toBe("R$ 5,4212");
  });
  it("período de referência por frequência", () => {
    expect(formatRef("2026-10-30", "diaria")).toBe("30/10/2026");
    expect(formatRef("2026-09-01", "trimestral_movel")).toBe("jul–set/2026");
    expect(formatRef("2026-01-01", "trimestral_movel")).toBe("nov–jan/2025–2026");
    expect(formatRef("2026-04-01", "trimestral")).toBe("2º tri/2026");
    expect(formatRefLong("2026-09-01", "trimestral_movel")).toBe("julho a setembro de 2026");
    expect(formatRefLong("2026-07-01", "trimestral")).toBe("3º trimestre de 2026");
    expect(formatRefLong("2026-10-30", "diaria")).toBe("30 de outubro de 2026");
  });
  it("soma meses mantendo o dia", () => {
    expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftMonths("2026-10-30", -12)).toBe("2025-10-30");
  });
  it("mês curto e datas", () => {
    expect(monthShort("2026-09-01")).toBe("set/2026");
    expect(formatDate("2026-11-12")).toBe("12/11/2026");
    expect(formatDate("2026-10-09T03:00:00+00:00")).toBe("09/10/2026");
  });
  it("hoje no fuso de Brasília", () => {
    // 01:30 UTC de 2/11 ainda é 1/11 em Brasília
    expect(todayInBrazil(new Date("2026-11-02T01:30:00Z"))).toBe("2026-11-01");
  });
  it("soma meses atravessando o ano", () => {
    expect(addMonths("2026-09-01", -12)).toBe("2025-09-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
  });
});

describe("janelas padrão", () => {
  const obs = monthly("2014-09-01", Array.from({ length: 145 }, (_, i) => i));
  it("12 meses inclui o mesmo mês do ano anterior", () => {
    const w = sliceWindow(obs, "12m");
    expect(w).toHaveLength(13);
    expect(w[0].refDate).toBe("2025-09-01");
  });
  it("5 e 10 anos", () => {
    expect(sliceWindow(obs, "5a")).toHaveLength(61);
    expect(sliceWindow(obs, "10a")).toHaveLength(121);
  });
  it("tudo devolve a série inteira", () => {
    expect(sliceWindow(obs, "tudo")).toHaveLength(145);
  });
});

describe("variação na janela", () => {
  it("taxa varia em pontos percentuais, com seta e verbo neutro", () => {
    const v = variation(monthly("2021-09-01", [10.25, 4.58]), "taxa")!;
    expect(v.direcao).toBe("cai");
    expect(v.diferenca).toBeCloseTo(5.67);
    expect(variationText(v, "5 anos", (n) => formatValue(n, "%"))).toBe(
      "↓ cai 5,67 p.p. em 5 anos (set/2021: 10,25%)",
    );
  });
  it("estável quando a diferença arredonda para zero", () => {
    const v = variation(monthly("2025-09-01", [4.581, 4.579]), "taxa")!;
    expect(v.direcao).toBe("estavel");
  });
});

describe("fonte principal e reserva", () => {
  const ibge = { id: "ibge", obs: monthly("2026-07-01", [4.44, 4.22, 4.58]) };
  const bcb = { id: "bcb", obs: monthly("2026-07-01", [4.44, 4.22, 4.58, 4.7]) };
  it("usa a principal quando está em dia", () => {
    expect(chooseSeries(ibge, { ...bcb, obs: bcb.obs.slice(0, 3) }).escolhida.id).toBe("ibge");
  });
  it("usa a reserva só se ela tiver período mais recente", () => {
    const r = chooseSeries(ibge, bcb);
    expect(r.escolhida.id).toBe("bcb");
    expect(r.usandoReserva).toBe(true);
  });
});

describe("atraso", () => {
  const releases = [
    { refDate: "2026-09-01", divulgadoEm: "2026-10-09T03:00:00Z", proximaDivulgacao: "2026-10-09" },
    { refDate: "2026-10-01", divulgadoEm: null, proximaDivulgacao: "2026-11-12" },
    { refDate: "2026-11-01", divulgadoEm: null, proximaDivulgacao: "2026-12-11" },
  ];
  const proxima = nextRelease(releases, "2026-09-01");
  it("próxima divulgação é a do período seguinte", () => {
    expect(proxima?.proximaDivulgacao).toBe("2026-11-12");
  });
  it("em dia antes e no dia da divulgação", () => {
    expect(delayStatus({ latestRef: "2026-09-01", frequencia: "mensal", proxima, hoje: "2026-11-12" }).atrasado).toBe(false);
  });
  it("atrasado a partir do dia seguinte, com rótulo do DESIGN.md", () => {
    expect(delayStatus({ latestRef: "2026-09-01", frequencia: "mensal", proxima, hoje: "2026-11-13" })).toEqual({
      atrasado: true,
      desde: "2026-11-13",
      rotulo: "Atrasado desde 13/11",
    });
  });
  it("sem calendário, usa o prazo da frequência", () => {
    expect(delayStatus({ latestRef: "2026-09-01", frequencia: "mensal", proxima: null, hoje: "2026-11-14" }).atrasado).toBe(false);
    expect(delayStatus({ latestRef: "2026-09-01", frequencia: "mensal", proxima: null, hoje: "2026-11-15" }).atrasado).toBe(true);
  });
});

describe("frase do template versionado", () => {
  const template = parseTemplate(
    readFileSync(join(__dirname, "../../../../config/templates/ipca_12m.pt.txt"), "utf8"),
  );
  it("monta a frase de alta com R$ 100 corrigidos", () => {
    expect(fraseAcumulado12m(template, "2026-09-01", 4.58)).toBe(
      "Em 12 meses até setembro de 2026, os preços subiram em média 4,58%. " +
        "Uma compra de R$ 100,00 em setembro de 2025 custaria R$ 104,58 em setembro de 2026.",
    );
  });
  it("usa a variante de queda para deflação", () => {
    expect(fraseAcumulado12m(template, "2026-09-01", -0.5)).toContain("caíram em média 0,50%");
    expect(fraseAcumulado12m(template, "2026-09-01", -0.5)).toContain("R$ 99,50");
  });
});

describe("CSV", () => {
  it("tem cabeçalho com fonte, série, unidade e data de coleta", () => {
    const csv = buildCsv(
      {
        titulo: "Inflação em 12 meses (IPCA)",
        orgao: "IBGE",
        fonteNome: "API de Agregados v3 (SIDRA)",
        urlFonte: "https://sidra.ibge.gov.br/tabela/1737",
        seriesId: "ibge_agregados_1737_2265",
        codigoExterno: "1737/2265",
        serieNome: "IPCA, variação acumulada em 12 meses",
        unidade: "%",
        urlPagina: "/indicador/ipca-12-meses",
      },
      monthly("2026-09-01", [4.58]),
    );
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe("# Fonte: IBGE, API de Agregados v3 (SIDRA) (https://sidra.ibge.gov.br/tabela/1737)");
    expect(lines).toContain("# Unidade: %");
    expect(lines).toContain("# Data da coleta mais recente: 2026-11-02T01:31:35Z");
    expect(lines.at(-1)).toBe(
      "2026-09-01,4.58,%,ibge_agregados_1737_2265,0,2026-11-02T01:31:35Z,storage://raw/x.json",
    );
  });
});

describe("séries de outras frequências", () => {
  it("último valor de cada mês, sem média", () => {
    const obs = [
      { refDate: "2026-09-29", value: 1 },
      { refDate: "2026-09-30", value: 2 },
      { refDate: "2026-10-01", value: 3 },
      { refDate: "2026-10-30", value: 4 },
    ];
    expect(lastOfMonth(obs).map((o) => o.value)).toEqual([2, 4]);
  });

  it("janela de 12 meses em série diária começa no mesmo dia", () => {
    const obs = [
      { refDate: "2025-10-29", value: 1 },
      { refDate: "2025-10-30", value: 2 },
      { refDate: "2026-10-30", value: 3 },
    ];
    expect(sliceWindow(obs, "12m").map((o) => o.refDate)).toEqual(["2025-10-30", "2026-10-30"]);
  });

  it("atraso de série diária depois de 5 dias corridos", () => {
    const base = { latestRef: "2026-10-30", frequencia: "diaria" as const, proxima: null };
    expect(delayStatus({ ...base, hoje: "2026-11-03" }).atrasado).toBe(false);
    expect(delayStatus({ ...base, hoje: "2026-11-04" }).atrasado).toBe(true);
  });

  it("trimestral usa o calendário do trimestre seguinte", () => {
    const proxima = { refDate: "2026-07-01", divulgadoEm: null, proximaDivulgacao: "2026-12-02" };
    const args = { latestRef: "2026-04-01", frequencia: "trimestral" as const, proxima };
    expect(delayStatus({ ...args, hoje: "2026-12-02" }).atrasado).toBe(false);
    expect(delayStatus({ ...args, hoje: "2026-12-03" }).atrasado).toBe(true);
  });
});

describe("frases dos templates do repositório", () => {
  const tpl = (f: string) =>
    parseTemplate(readFileSync(join(__dirname, `../../../../config/templates/${f}`), "utf8"));

  it("desocupação usa o trimestre móvel por extenso", () => {
    const texto = frase("desocupacao.pt.txt", tpl("desocupacao.pt.txt"), {
      refDate: "2026-09-01",
      value: 5.6,
      unidade: "%",
      casas: 1,
      frequencia: "trimestral_movel",
    });
    expect(texto).toBe(
      "No trimestre de julho a setembro de 2026, de cada 100 pessoas na força de trabalho, 5,6 procuravam emprego e não tinham.",
    );
  });

  it("PIB escolhe a variante pelo sinal e mostra o valor sem sinal", () => {
    const t = tpl("pib_trimestre.pt.txt");
    const ctx = { refDate: "2026-04-01", unidade: "%", casas: 1, frequencia: "trimestral" as const };
    expect(frase("pib_trimestre.pt.txt", t, { ...ctx, value: -0.4 })).toContain("diminuiu 0,4%");
    expect(frase("pib_trimestre.pt.txt", t, { ...ctx, value: 0.4 })).toContain("cresceu 0,4%");
    expect(frase("pib_trimestre.pt.txt", t, { ...ctx, value: 0.04 })).toContain("ficou igual");
  });

  it("Selic: 'desde' é o início do valor vigente na série", () => {
    const obs = [
      { refDate: "2026-09-17", value: 14.25 },
      { refDate: "2026-09-18", value: 13.75 },
      { refDate: "2026-09-19", value: 13.75 },
      { refDate: "2026-11-01", value: 13.75 },
    ];
    const ctx = { refDate: "2026-11-01", value: 13.75, unidade: "% a.a.", casas: 2, frequencia: "diaria" as const, obs };
    expect(inicioDoValorVigente(ctx)).toBe("2026-09-18");
    expect(frase("selic.pt.txt", tpl("selic.pt.txt"), ctx)).toContain("está em 13,75% ao ano desde 18 de setembro de 2026");
  });
});
