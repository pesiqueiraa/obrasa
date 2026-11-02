"use client";

// Mês e ano em dois seletores nativos (funcionam bem no celular e no teclado), limitados
// aos meses que a série publicou.

import styles from "./ferramentas.module.scss";

const NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function SeletorMes(props: {
  meses: string[]; // AAAA-MM, em ordem
  valor: string;
  onChange: (mes: string) => void;
  rotulo: string;
  id?: string;
}) {
  const { meses, valor, onChange, rotulo, id } = props;
  const [ano, mes] = valor.split("-");
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))];
  const doAno = (a: string) => meses.filter((m) => m.startsWith(a)).map((m) => m.slice(5));
  return (
    <span className={styles.seletor} role="group" aria-label={rotulo}>
      <select
        id={id}
        aria-label={`${rotulo}: mês`}
        value={mes}
        onChange={(e) => onChange(`${ano}-${e.target.value}`)}
      >
        {doAno(ano).map((m) => (
          <option key={m} value={m}>
            {NOMES[Number(m) - 1]}
          </option>
        ))}
      </select>
      <select
        aria-label={`${rotulo}: ano`}
        value={ano}
        onChange={(e) => {
          const ms = doAno(e.target.value);
          onChange(`${e.target.value}-${ms.includes(mes) ? mes : ms.at(-1)}`);
        }}
      >
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </span>
  );
}
