import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { avalia } = await import("./saude");

const config = {
  jobs: {
    todos: { horas: 27, workflow: "coleta.yml" },
    noticias: { horas: 3, workflow: "noticias.yml" },
  },
  noticia_mais_recente_horas: 24,
};
const agora = new Date("2026-11-02T15:00:00Z");

describe("avalia", () => {
  it("tudo no prazo, mesmo com a última execução falhando", () => {
    const s = avalia(
      config,
      {
        ultimaExecucao: {
          todos: { terminadoEm: "2026-11-02T13:05:00Z", ok: false },
          noticias: { terminadoEm: "2026-11-02T14:31:00Z", ok: true },
        },
        noticiaMaisRecente: "2026-11-02T14:10:00Z",
      },
      agora,
    );
    expect(s.ok).toBe(true);
    expect(s.jobs[0]).toMatchObject({ job: "todos", ultimaOk: false, noPrazo: true });
  });

  it("job que parou de rodar ou nunca rodou derruba o status", () => {
    const s = avalia(
      config,
      {
        ultimaExecucao: {
          todos: { terminadoEm: "2026-11-01T11:00:00Z", ok: true },
          noticias: null,
        },
        noticiaMaisRecente: "2026-11-02T14:10:00Z",
      },
      agora,
    );
    expect(s.ok).toBe(false);
    expect(s.jobs.map((j) => j.noPrazo)).toEqual([false, false]);
  });

  it("notícias paradas derrubam o status", () => {
    const s = avalia(
      config,
      {
        ultimaExecucao: {
          todos: { terminadoEm: "2026-11-02T13:05:00Z", ok: true },
          noticias: { terminadoEm: "2026-11-02T14:31:00Z", ok: true },
        },
        noticiaMaisRecente: "2026-11-01T10:00:00Z",
      },
      agora,
    );
    expect(s.ok).toBe(false);
    expect(s.noticias.noPrazo).toBe(false);
  });
});
