// Para onde foram os eleitores aptos, em cada turno: válidos, brancos, nulos, abstenção
// e eleitores de seções não instaladas. Uma barra de 100% por turno, mesma escala.

import { formatDate } from "@/lib/format";
import type { Apuracao } from "@/lib/eleicoes";
import styles from "./eleicoes.module.scss";
import { inteiro, pct } from "./util";

const PARTES = [
  { k: "validos", rotulo: "Votos válidos", cls: "segValidos" },
  { k: "brancos", rotulo: "Brancos", cls: "segBrancos" },
  { k: "nulos", rotulo: "Nulos", cls: "segNulos" },
  { k: "abstencoes", rotulo: "Abstenção", cls: "segAbst" },
  { k: "naoInstaladas", rotulo: "Seção não instalada", cls: "segNaoInst" },
] as const;

export function Comparecimento({ turnos }: { turnos: Apuracao[] }) {
  return (
    <div className={styles.comp}>
      {turnos.map((a) => (
        <figure key={a.turno} className={styles.compTurno}>
          <figcaption>
            <strong>{a.turno}º turno</strong>, {formatDate(a.data)}: {inteiro(a.comparecimento)} de{" "}
            {inteiro(a.aptos)} eleitores aptos compareceram ({pct(a.comparecimento, a.aptos)}).
          </figcaption>
          <div className={styles.compBarra} aria-hidden="true">
            {PARTES.map((p) => (
              <span key={p.k} className={styles[p.cls]} style={{ width: `${(a[p.k] / a.aptos) * 100}%` }} />
            ))}
          </div>
          <dl className={styles.compLegenda}>
            {PARTES.map((p) => (
              <div key={p.k}>
                <dt>
                  <span className={`${styles.chave} ${styles[p.cls]}`} aria-hidden="true" />
                  {p.rotulo}
                </dt>
                <dd>
                  {pct(a[p.k], a.aptos)} <span>{inteiro(a[p.k])}</span>
                </dd>
              </div>
            ))}
          </dl>
        </figure>
      ))}
    </div>
  );
}
