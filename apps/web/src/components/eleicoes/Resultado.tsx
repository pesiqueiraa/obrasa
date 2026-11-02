// Resultado para presidente. Segundo turno: barra dividida, os dois candidatos na mesma
// cor, separados por um traço, com marca em 50% dos votos válidos. Primeiro turno: uma
// linha por candidato, na ordem dos votos, todas na mesma escala de 0 a 100%.
// Sem cor por candidato ou partido (docs/08, D14).

import type { CandidatoPresidente, Turno, VotoUf } from "@/lib/eleicoes";
import { BarraCresce } from "./BarraCresce";
import styles from "./eleicoes.module.scss";
import { inteiro, nomeProprio, pct } from "./util";

export type Linha = { c: CandidatoPresidente; votos: number };

export function linhasDoTurno(candidatos: CandidatoPresidente[], votos: VotoUf[], turno: Turno, uf = "BR"): Linha[] {
  const porNr = new Map(candidatos.map((c) => [c.nr, c]));
  return votos
    .filter((v) => v.turno === turno && v.uf === uf && porNr.has(v.nr))
    .map((v) => ({ c: porNr.get(v.nr)!, votos: v.votos }))
    .sort((a, b) => b.votos - a.votos || a.c.nr - b.c.nr);
}

function Situacao({ texto }: { texto?: string }) {
  if (!texto) return null;
  // palavras do TSE, só em caixa de frase: "NÃO ELEITO" → "Não eleito"
  const t = texto.toLocaleLowerCase("pt-BR");
  return <span className={styles.situacao}>{t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1)}</span>;
}

export function SegundoTurno({ linhas, validos, turno }: { linhas: Linha[]; validos: number; turno: Turno }) {
  const [a, b] = linhas;
  const pa = (a.votos / validos) * 100;
  return (
    <div className={styles.duelo}>
      <div className={styles.dueloNomes}>
        {[a, b].map((l, i) => (
          <div key={l.c.nr} className={i === 1 ? styles.dueloDireita : undefined}>
            <p className={styles.dueloNome}>
              {nomeProprio(l.c.nome)} <span className={styles.partido}>{l.c.partido}</span>
            </p>
            <p className={styles.dueloPct}>{pct(l.votos, validos)}</p>
            <p className={styles.dueloVotos}>
              {inteiro(l.votos)} votos <Situacao texto={l.c.situacao[turno]} />
            </p>
          </div>
        ))}
      </div>
      <div
        className={styles.dueloBarra}
        role="img"
        aria-label={`${nomeProprio(a.c.nome)}: ${pct(a.votos, validos)} dos votos válidos. ${nomeProprio(b.c.nome)}: ${pct(b.votos, validos)}.`}
      >
        <BarraCresce largura={pa} className={styles.dueloA} />
        <span className={styles.dueloMeio} aria-hidden="true" />
      </div>
      <p className={styles.legendaMeio} aria-hidden="true">
        50% dos votos válidos
      </p>
    </div>
  );
}

export function PrimeiroTurno({ linhas, validos, turno }: { linhas: Linha[]; validos: number; turno: Turno }) {
  return (
    <ol className={styles.lista}>
      {linhas.map((l, i) => (
        <li key={l.c.nr} className={styles.listaLinha}>
          <p className={styles.listaNome}>
            {nomeProprio(l.c.nome)} <span className={styles.partido}>{l.c.partido}</span>{" "}
            <Situacao texto={l.c.situacao[turno]} />
          </p>
          <div className={styles.listaTrilho} aria-hidden="true">
            <BarraCresce largura={(l.votos / validos) * 100} atraso={i * 0.04} className={styles.listaBarra} />
          </div>
          <p className={styles.listaValor}>
            <strong>{pct(l.votos, validos)}</strong> <span>{inteiro(l.votos)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
