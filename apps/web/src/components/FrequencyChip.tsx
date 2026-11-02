// frequency-chip / frequency-chip-delayed (DESIGN.md).

import { FREQUENCIA_ROTULO, type Atraso, type Frequencia } from "@/lib/indicator";
import styles from "./ui.module.scss";

export function FrequencyChip({ frequencia, atraso }: { frequencia: Frequencia; atraso: Atraso }) {
  if (atraso.atrasado) {
    return (
      <span className={`${styles.chip} ${styles.chipDelayed}`}>
        {FREQUENCIA_ROTULO[frequencia]}, {atraso.rotulo}
      </span>
    );
  }
  return <span className={styles.chip}>{FREQUENCIA_ROTULO[frequencia]}</span>;
}
