import { describe, expect, it } from "vitest";
import { anosDoMandato, fimDoPeriodo, posseEFim, ultimoAte, variacao } from "./mandato";

const mensal = [
  { refDate: "2002-11-01", value: 10.9 },
  { refDate: "2002-12-01", value: 12.53 },
  { refDate: "2003-01-01", value: 14.47 },
  { refDate: "2006-11-01", value: 3.02 },
  { refDate: "2006-12-01", value: 3.14 },
  { refDate: "2007-01-01", value: 2.99 },
];

describe("fimDoPeriodo", () => {
  it("usa o último dia do período de cada frequência", () => {
    expect(fimDoPeriodo("2016-02-01", "mensal")).toBe("2016-02-29");
    expect(fimDoPeriodo("2016-03-01", "trimestral_movel")).toBe("2016-03-31");
    expect(fimDoPeriodo("2019-10-01", "trimestral")).toBe("2019-12-31");
    expect(fimDoPeriodo("2019-01-01", "trimestral")).toBe("2019-03-31");
    expect(fimDoPeriodo("2019-07-01", "anual")).toBe("2019-12-31");
    expect(fimDoPeriodo("2002-12-31", "diaria")).toBe("2002-12-31");
  });
});

describe("posseEFim", () => {
  it("pega dezembro antes da posse de 1º de janeiro e dezembro do último ano", () => {
    const { posse, fim } = posseEFim(mensal, "mensal", "2003-01-01", "2006-12-31", "2026-11-08");
    expect(posse?.refDate).toBe("2002-12-01");
    expect(fim?.refDate).toBe("2006-12-01");
  });

  it("mandato que termina no meio do mês fica com o mês anterior", () => {
    const obs = [
      { refDate: "2016-04-01", value: 9.28 },
      { refDate: "2016-05-01", value: 9.32 },
    ];
    expect(posseEFim(obs, "mensal", "2015-01-01", "2016-05-11", "2026-11-08").fim?.refDate).toBe("2016-04-01");
    expect(posseEFim(obs, "mensal", "2016-05-12", "2018-12-31", "2026-11-08").posse?.refDate).toBe("2016-04-01");
  });

  it("mandato em curso não usa o mês que ainda não terminou", () => {
    const obs = [
      { refDate: "2026-10-01", value: 14.9 },
      { refDate: "2026-11-01", value: 13.65 },
    ];
    expect(posseEFim(obs, "mensal", "2023-01-01", null, "2026-11-08").fim?.refDate).toBe("2026-10-01");
  });

  it("mandato em curso aceita o último trimestre divulgado, mesmo meses atrás", () => {
    const obs = [
      { refDate: "2022-10-01", value: 3.0 },
      { refDate: "2026-04-01", value: 2.1 },
    ];
    expect(posseEFim(obs, "trimestral", "2023-01-01", null, "2026-11-08").fim?.refDate).toBe("2026-04-01");
  });

  it("série que começa depois da posse fica sem ponto de posse", () => {
    const obs = [
      { refDate: "2012-03-01", value: 8.0 },
      { refDate: "2014-12-01", value: 6.6 },
    ];
    const r = posseEFim(obs, "trimestral_movel", "2011-01-01", "2014-12-31", "2026-11-08");
    expect(r.posse).toBeNull();
    expect(r.fim?.refDate).toBe("2014-12-01");
  });

  it("ponto antigo demais conta como sem dado", () => {
    expect(ultimoAte(mensal, "mensal", "2010-12-31")).toBeNull();
  });

  it("série que acaba antes do fim não dá ponto de fim", () => {
    const r = posseEFim(mensal.slice(0, 2), "mensal", "2003-01-01", "2006-12-31", "2026-11-08");
    expect(r.posse?.refDate).toBe("2002-12-01");
    expect(r.fim).toBeNull();
  });
});

describe("variacao", () => {
  it("pontos percentuais para taxa e % para nível", () => {
    expect(variacao("taxa", 12.53, 3.14)).toEqual({ valor: 3.14 - 12.53, unidade: "p.p." });
    expect(variacao("nivel", 200, 350).valor).toBeCloseTo(75);
    expect(variacao("nivel", 200, 350).unidade).toBe("%");
  });
});

describe("anosDoMandato", () => {
  it("o ano fica com quem estava no cargo em 31/12", () => {
    expect(anosDoMandato("2015-01-01", "2016-05-11", "2026-11-08")).toEqual([2015]);
    expect(anosDoMandato("2016-05-12", "2018-12-31", "2026-11-08")).toEqual([2016, 2017, 2018]);
    expect(anosDoMandato("1999-01-01", "2002-12-31", "2026-11-08")).toEqual([1999, 2000, 2001, 2002]);
  });

  it("mandato em curso inclui o ano corrente", () => {
    expect(anosDoMandato("2023-01-01", null, "2026-11-08")).toEqual([2023, 2024, 2025, 2026]);
  });
});
