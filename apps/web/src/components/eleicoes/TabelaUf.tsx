// Tabela por UF: a alternativa em texto do mapa (mesmos dados, agregados por estado).
// Mostra os candidatos com pelo menos 1% dos válidos no país; os demais somados.

import type { Apuracao, Turno, VotoUf } from "@/lib/eleicoes";
import type { Linha } from "./Resultado";
import styles from "./eleicoes.module.scss";
import { UF_NOME, inteiro, nomeProprio, pct } from "./util";

export function TabelaUf({ turno, linhas, votos, apuracao }: { turno: Turno; linhas: Linha[]; votos: VotoUf[]; apuracao: Apuracao[] }) {
  const br = apuracao.find((a) => a.turno === turno && a.uf === "BR")!;
  const cols = linhas.filter((l) => l.votos / br.validos >= 0.01);
  const resto = linhas.length > cols.length;
  const ufs = apuracao.filter((a) => a.turno === turno && a.uf !== "BR").sort((a, b) => (a.uf === "ZZ" ? 1 : b.uf === "ZZ" ? -1 : a.uf.localeCompare(b.uf)));
  const v = (uf: string, nr: number) => votos.find((x) => x.turno === turno && x.uf === uf && x.nr === nr)?.votos ?? 0;
  return (
    <div className={styles.tabelaWrap}>
      <table className="simple-table">
        <caption className="visually-hidden">Votos válidos para presidente no {turno}º turno, por unidade da federação</caption>
        <thead>
          <tr>
            <th scope="col">UF</th>
            {cols.map((l) => (
              <th key={l.c.nr} scope="col" className="num">
                {nomeProprio(l.c.nome)}
              </th>
            ))}
            {resto ? <th scope="col" className="num">Demais</th> : null}
            <th scope="col" className="num">Votos válidos</th>
          </tr>
        </thead>
        <tbody>
          {[...ufs, br].map((a) => {
            const soma = cols.reduce((s, l) => s + v(a.uf, l.c.nr), 0);
            return (
              <tr key={a.uf} className={a.uf === "BR" ? styles.linhaTotal : undefined}>
                <th scope="row">{a.uf === "BR" ? "Brasil" : UF_NOME[a.uf]}</th>
                {cols.map((l) => (
                  <td key={l.c.nr} className="num">
                    {pct(v(a.uf, l.c.nr), a.validos)}
                  </td>
                ))}
                {resto ? <td className="num">{pct(a.validos - soma, a.validos)}</td> : null}
                <td className="num">{inteiro(a.validos)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
