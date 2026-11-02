"use client";

// Mapa por município (docs/08, D14): um tom só, a cor mostra a fatia dos votos válidos
// do candidato escolhido em cada município. A escala é a mesma para todos os candidatos
// (faixas fixas de 20 pontos) e não existe "cor do vencedor". Projeção cônica de áreas
// iguais, para o tamanho na tela ser proporcional à área.

import { geoConicEqualArea, geoPath } from "d3-geo";
import { useEffect, useMemo, useState } from "react";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MapaPresidente as Dados } from "@/lib/eleicoes";
import styles from "./eleicoes.module.scss";
import { inteiro, nomeProprio, pct } from "./util";

const W = 600;
const H = 620;
const FAIXAS = ["0 a 20%", "20 a 40%", "40 a 60%", "60 a 80%", "80 a 100%"];

export type CandidatoMapa = { nr: number; nome: string; partido: string };

type Malha = { municipios: Topology; ufs: Topology };

function faixa(share: number): number {
  return Math.min(4, Math.floor(share * 5));
}

export function MapaPresidente({ candidatos }: { candidatos: Record<1 | 2, CandidatoMapa[]> }) {
  const [malha, setMalha] = useState<Malha | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [turno, setTurno] = useState<1 | 2>(2);
  const [nr, setNr] = useState(candidatos[2][0]?.nr ?? candidatos[1][0].nr);
  const [foco, setFoco] = useState<{ ibge: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      fetch("/eleicoes-2026/mapa/malha.json").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch("/eleicoes-2026/mapa/presidente.json").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([m, d]) => {
        if (vivo) {
          setMalha(m);
          setDados(d);
        }
      })
      .catch(() => vivo && setErro("O mapa não carregou. Os mesmos números estão na tabela por estado, abaixo."));
    return () => {
      vivo = false;
    };
  }, []);

  const desenho = useMemo(() => {
    if (!malha) return null;
    const mun = malha.municipios.objects.BRMU as GeometryCollection<{ codarea: string }>;
    const uf = malha.ufs.objects.BRUF as GeometryCollection;
    const contorno = feature(malha.ufs, uf);
    const proj = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).fitSize([W, H], contorno);
    const path = geoPath(proj);
    const munFeat = feature(malha.municipios, mun);
    return {
      municipios: munFeat.features.map((f) => ({ ibge: Number(f.properties?.codarea), d: path(f) ?? "" })),
      divisas: path(mesh(malha.ufs, uf, (a, b) => a !== b)) ?? "",
      borda: path(mesh(malha.ufs, uf, (a, b) => a === b)) ?? "",
    };
  }, [malha]);

  const porMunicipio = useMemo(() => {
    if (!dados) return null;
    const t = dados.turnos[turno];
    const k = t.candidatos.indexOf(nr);
    const m = new Map<number, { val: number; votos: number }>();
    for (const l of t.linhas) m.set(l[0], { val: l[1], votos: k >= 0 ? l[2 + k] : 0 });
    return m;
  }, [dados, turno, nr]);

  const semDesenho = useMemo(() => {
    if (!dados || !desenho) return [];
    const tem = new Set(desenho.municipios.map((m) => m.ibge));
    return Object.entries(dados.municipios)
      .filter(([ibge]) => !tem.has(Number(ibge)))
      .map(([, [nome, uf]]) => `${nome} (${uf})`);
  }, [dados, desenho]);

  const lista = candidatos[turno];
  const atual = lista.find((c) => c.nr === nr) ?? lista[0];
  const trocarTurno = (t: 1 | 2) => {
    setTurno(t);
    if (!candidatos[t].some((c) => c.nr === nr)) setNr(candidatos[t][0].nr);
  };
  const info = foco && porMunicipio?.get(foco.ibge);
  const nomeMun = foco && dados?.municipios[foco.ibge];

  return (
    <div className={styles.mapa}>
      <div className={styles.controles}>
        <fieldset>
          <legend>Turno</legend>
          <div className={styles.segmentos}>
            {([2, 1] as const).map((t) => (
              <label key={t} className={turno === t ? styles.segOn : undefined}>
                <input type="radio" name="turno" checked={turno === t} onChange={() => trocarTurno(t)} />
                {t}º turno
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Candidato</legend>
          <div className={styles.chips}>
            {lista.map((c) => (
              <label key={c.nr} className={c.nr === atual.nr ? styles.chipOn : undefined}>
                <input type="radio" name="candidato" checked={c.nr === atual.nr} onChange={() => setNr(c.nr)} />
                {nomeProprio(c.nome)} <span className={styles.partido}>{c.partido}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p className={styles.mapaTitulo}>
        Votos válidos de {nomeProprio(atual.nome)} ({atual.partido}) no {turno}º turno, por município
      </p>
      <ul className={styles.escala} aria-label="Escala de cores">
        {FAIXAS.map((f, i) => (
          <li key={f}>
            <span className={`${styles.chave} ${styles[`b${i}`]}`} aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>

      <div className={styles.mapaCaixa} onMouseLeave={() => setFoco(null)}>
        {erro ? <p className={styles.mapaErro}>{erro}</p> : null}
        {!desenho || !porMunicipio ? (
          !erro && <p className={styles.mapaCarregando}>Carregando mapa dos 5.570 municípios…</p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className={styles.mapaSvg}
            role="img"
            aria-label={`Mapa do Brasil por município: votos válidos de ${nomeProprio(atual.nome)} no ${turno}º turno, em faixas de 20 pontos percentuais. A tabela por estado abaixo traz os mesmos dados.`}
            onPointerMove={(e) => {
              const t = e.target as SVGElement;
              const ibge = Number(t.dataset.m);
              if (!ibge) return setFoco(null);
              const box = e.currentTarget.getBoundingClientRect();
              setFoco({ ibge, x: e.clientX - box.left, y: e.clientY - box.top });
            }}
          >
            <g>
              {desenho.municipios.map((m) => {
                const v = porMunicipio.get(m.ibge);
                const cls = v && v.val > 0 ? styles[`b${faixa(v.votos / v.val)}`] : styles.semDado;
                return <path key={m.ibge} d={m.d} data-m={m.ibge} className={cls} />;
              })}
            </g>
            <path d={desenho.divisas} className={styles.divisa} />
            <path d={desenho.borda} className={styles.borda} />
          </svg>
        )}
        {info && nomeMun ? (
          <div className={styles.dica} style={{ left: foco!.x, top: foco!.y }} role="status">
            <strong>
              {nomeMun[0]} ({nomeMun[1]})
            </strong>
            <br />
            {pct(info.votos, info.val)} dos válidos
            <br />
            {inteiro(info.votos)} de {inteiro(info.val)} votos
          </div>
        ) : null}
      </div>
      {semDesenho.length > 0 ? (
        <p className={styles.nota}>
          Sem desenho na malha do IBGE: {semDesenho.join(", ")}. Os votos estão nos totais e na tabela.
        </p>
      ) : null}
    </div>
  );
}
