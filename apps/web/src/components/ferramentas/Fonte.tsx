// Linha de fonte das ferramentas (regra 2): "Fonte: IBGE (set/2026)", com link, e a
// explicação da conta logo abaixo.

import type { ReactNode } from "react";
import { formatRef, type FrequenciaRef } from "@/lib/format";
import type { Fonte as F } from "@/lib/ferramentas";
import ui from "../ui.module.scss";
import styles from "./ferramentas.module.scss";

export function Fonte({ fonte, children }: { fonte: F; children?: ReactNode }) {
  return (
    <div className={styles.fonte}>
      <p className={ui.sourceLine}>
        Fonte:{" "}
        {fonte.url ? (
          <a href={fonte.url} rel="noopener">
            {fonte.orgao}
          </a>
        ) : (
          fonte.orgao
        )}{" "}
        ({formatRef(fonte.ref, fonte.frequencia as FrequenciaRef)})
      </p>
      {children ? <p className={styles.metodo}>{children}</p> : null}
    </div>
  );
}
