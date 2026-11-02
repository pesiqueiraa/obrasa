// Frase de variação ("↓ cai 5,67 p.p. em 5 anos"). DESIGN.md, "variation": seta fina e
// cor por direção, em tons neutros que não dizem se é bom ou ruim (docs/02): sobe em
// azul-tinta, cai em cinza-escuro. A direção também está no texto, nunca só na cor.

import type { ReactNode } from "react";
import ui from "./ui.module.scss";

export type Direcao = "sobe" | "cai" | "estavel";

export const SETA: Record<Direcao, string> = { sobe: "↑", cai: "↓", estavel: "=" };

/** Direção pela seta no começo do texto ("↑ ...", "↓ ..."). */
export function direcaoDe(texto: string): Direcao {
  return texto.startsWith(SETA.sobe) ? "sobe" : texto.startsWith(SETA.cai) ? "cai" : "estavel";
}

export function Variacao(props: { texto: string; className?: string; children?: ReactNode; as?: "p" | "span" }) {
  const { texto, className, children, as: Tag = "p" } = props;
  const d = direcaoDe(texto);
  const resto = d === "estavel" ? texto : texto.slice(1).trimStart();
  // Texto curto sem o verbo ("↓ 0,59 p.p."): o leitor de tela ouve "cai" no lugar da seta.
  const temVerbo = /^(sobe|cai)\b/.test(resto);
  return (
    <Tag className={`${className ?? ""} ${ui[`var_${d}`] ?? ""}`.trim()}>
      {d !== "estavel" ? (
        <>
          <span aria-hidden="true" className={ui.setaFina}>
            {SETA[d]}
          </span>{" "}
          {temVerbo ? null : <span className="visually-hidden">{d} </span>}
        </>
      ) : null}
      {resto}
      {children}
    </Tag>
  );
}
