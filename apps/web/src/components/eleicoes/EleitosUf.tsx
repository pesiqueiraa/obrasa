// Governadores e senadores eleitos por UF, com o partido e, para governador, o turno
// em que a eleição foi decidida.

import type { Eleito } from "@/lib/eleicoes";
import styles from "./eleicoes.module.scss";
import { UF_NOME, nomeProprio } from "./util";

export function EleitosUf({ eleitos }: { eleitos: Eleito[] }) {
  const ufs = Object.keys(UF_NOME).filter((u) => u !== "ZZ");
  const gov = new Map(eleitos.filter((e) => e.cargo === "GOVERNADOR").map((e) => [e.uf, e]));
  const sen = (uf: string) => eleitos.filter((e) => e.cargo === "SENADOR" && e.uf === uf);
  return (
    <div className={styles.tabelaWrap}>
      <table className="simple-table">
        <caption className="visually-hidden">Governadores e senadores eleitos em 2026, por unidade da federação</caption>
        <thead>
          <tr>
            <th scope="col">UF</th>
            <th scope="col">Governador</th>
            <th scope="col">Decidido no</th>
            <th scope="col">Senadores</th>
          </tr>
        </thead>
        <tbody>
          {ufs.map((uf) => {
            const g = gov.get(uf);
            return (
              <tr key={uf}>
                <th scope="row">
                  {UF_NOME[uf]}
                </th>
                <td>{g ? <>{nomeProprio(g.nome)} <span className={styles.partido}>{g.partido}</span></> : "–"}</td>
                <td>{g ? `${g.turno}º turno` : "–"}</td>
                <td>
                  {sen(uf).map((s, i) => (
                    <span key={s.nome}>
                      {i > 0 ? "; " : ""}
                      {nomeProprio(s.nome)} <span className={styles.partido}>{s.partido}</span>
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
