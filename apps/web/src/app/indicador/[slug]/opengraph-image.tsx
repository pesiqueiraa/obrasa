// Imagem de compartilhamento de cada indicador (DESIGN.md, "Imagem de compartilhamento").
// Mesmos números da página, lidos do banco: valor, período, variação, minilinha e fonte
// curta (regras 1 e 2). Fontes IBM Plex em .woff (o gerador não lê .woff2), OFL.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CRUZEIRO } from "@/components/Logo";
import { getIndicatorView, getTemas, listIndicatorSlugs } from "@/lib/data";
import { formatRef } from "@/lib/format";
import { present } from "@/lib/present";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Indicador do oBrasa: valor mais recente, período de referência e fonte.";

export async function generateStaticParams() {
  return (await listIndicatorSlugs()).map((slug) => ({ slug }));
}

const COR = { ink: "#161616", muted: "#525252", primary: "#23408E", hairline: "#e0e0e0" };

async function fonte(nome: string) {
  return readFile(join(process.cwd(), "assets/og", nome));
}

function linha(values: (number | null)[], w: number, h: number): string {
  const nums = values.filter((v): v is number => v !== null);
  const min = Math.min(...nums);
  const span = Math.max(...nums) - min || 1;
  const x = (i: number) => 6 + (i / Math.max(values.length - 1, 1)) * (w - 12);
  const y = (v: number) => 6 + (1 - (v - min) / span) * (h - 12);
  return values
    .map((v, i) => (v === null ? "" : `${i && values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .join(" ");
}

/** "↑ sobe 0,4 p.p. em 12 meses": seta fina desenhada em SVG e cor neutra por direção
 *  (sobe em azul-tinta, cai em cinza-escuro), como no site. */
function Variacao({ texto }: { texto: string }) {
  const d = texto[0] === "↑" ? "sobe" : texto[0] === "↓" ? "cai" : null;
  const cor = d === "sobe" ? COR.primary : d === "cai" ? COR.muted : COR.ink;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, marginTop: 18, color: cor }}>
      {d ? (
        <svg width={14} height={22} viewBox="0 0 14 22">
          <path d={d === "sobe" ? "M7,21 L7,2 M1,8 L7,2 L13,8" : "M7,1 L7,20 M1,14 L7,20 L13,14"} fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      <span>{d ? texto.slice(1).trim() : texto}</span>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [view, temas, regular, semibold, serif] = await Promise.all([
    getIndicatorView(slug),
    getTemas(),
    fonte("IBMPlexSans-Regular.woff"),
    fonte("IBMPlexSans-SemiBold.woff"),
    fonte("IBMPlexSerif-Medium.woff"),
  ]);
  if (!view) return new Response("indicador não encontrado", { status: 404 });
  const p = present(view);
  const { indicator, exibida } = view;
  const freq = exibida.series.frequencia;
  const tema = temas.find((t) => t.slug === indicator.tema)?.titulo ?? "";
  const W = 380;
  const H = 170;
  const temLinha = p.spark.filter((v) => v !== null).length >= 2;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        color: COR.ink,
        fontFamily: "Plex Sans",
        padding: "56px 72px",
        borderTop: `12px solid ${COR.primary}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width={36} height={48} viewBox="5 0 30 40">
            {CRUZEIRO.map(([cx, cy, r]) => (
              <circle key={`${cx}`} cx={cx} cy={cy} r={r} fill={COR.primary} />
            ))}
          </svg>
          <div style={{ display: "flex", fontFamily: "Plex Serif", fontSize: 40 }}>
            <span style={{ color: COR.primary }}>o</span>
            <span>Brasa</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: COR.muted }}>{tema}</div>
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 600, lineHeight: 1.15 }}>{indicator.titulo}</div>
          <div style={{ display: "flex", fontSize: 100, fontWeight: 600, letterSpacing: -2, lineHeight: 1, marginTop: 16, whiteSpace: "nowrap" }}>
            {p.fmt(p.latest.value)}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: COR.muted, marginTop: 10 }}>
            {formatRef(p.latest.refDate, freq)}
            {p.baseReal ? `, ${p.baseReal}` : ""}
          </div>
          {p.variacao ? <Variacao texto={p.variacao} /> : null}
        </div>
        {temLinha ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginLeft: "auto" }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <path d={linha(p.spark, W, H)} fill="none" stroke={COR.primary} strokeWidth={4} strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 20, color: COR.muted }}>{p.janelaRotulo}</span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: `2px solid ${COR.hairline}`,
          paddingTop: 20,
          fontSize: 24,
          color: COR.muted,
        }}
      >
        <span>
          Fonte: {exibida.source.orgao} ({formatRef(p.latest.refDate, freq)})
        </span>
        <span>Dados oficiais do Brasil, com contexto e sem lado</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Plex Sans", data: regular, weight: 400, style: "normal" },
        { name: "Plex Sans", data: semibold, weight: 600, style: "normal" },
        { name: "Plex Serif", data: serif, weight: 500, style: "normal" },
      ],
    },
  );
}
