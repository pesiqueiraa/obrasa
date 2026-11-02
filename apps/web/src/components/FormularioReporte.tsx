"use client";

// Formulário "Reportar erro" (DESIGN.md: campos Carbon, fundo surface-1 e filete inferior;
// vermelho só em erro de formulário). Não pede nome, e-mail nem nada que identifique.

import { useActionState, useEffect, useRef } from "react";
import { enviaReporte } from "@/app/reportar-erro/acao";
import { type Estado, LIMITES } from "@/lib/reportes";
import styles from "./reporte.module.scss";

const INICIO: Estado = { tipo: "inicio" };

export function FormularioReporte() {
  const [estado, envia, enviando] = useActionState(enviaReporte, INICIO);
  // Marca a hora em que a página abriu no navegador (não no build): envio rápido demais é robô.
  const abertoEm = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (abertoEm.current && !abertoEm.current.value) abertoEm.current.value = String(Date.now());
  });

  if (estado.tipo === "enviado") {
    return (
      <div className={styles.recebido} role="status">
        <p className={styles.recebidoTitulo}>Reporte recebido (nº {estado.numero}).</p>
        <p>
          Vamos conferir na fonte oficial. Se houver erro, a correção entra na página de Correções, com a data e o que
          mudou.
        </p>
      </div>
    );
  }

  const erro = estado.tipo === "erro" ? estado : null;
  const valor = (c: "pagina" | "descricao" | "fonte") => erro?.valores[c] ?? "";
  const invalido = (c: string) => (erro?.campo === c ? true : undefined);
  const mensagem = (c: string) =>
    erro?.campo === c ? (
      <p id={`erro-${c}`} className={styles.erro}>
        {erro.mensagem}
      </p>
    ) : null;

  return (
    <form action={envia} className={styles.form} noValidate>
      <input ref={abertoEm} type="hidden" name="aberto_em" defaultValue="" />
      {/* Campo isca: escondido de quem usa o site; robôs costumam preencher. */}
      <div className={styles.isca} aria-hidden="true">
        <label>
          Site
          <input type="text" name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className={styles.campo}>
        <label htmlFor="descricao">O que está errado?</label>
        <p className={styles.ajuda} id="ajuda-descricao">
          Diga qual número ou texto, e o que a fonte oficial mostra.
        </p>
        <textarea
          id="descricao"
          name="descricao"
          rows={6}
          required
          minLength={LIMITES.descricaoMin}
          maxLength={LIMITES.descricao}
          defaultValue={valor("descricao")}
          aria-invalid={invalido("descricao")}
          aria-describedby={erro?.campo === "descricao" ? "ajuda-descricao erro-descricao" : "ajuda-descricao"}
        />
        {mensagem("descricao")}
      </div>

      <div className={styles.campo}>
        <label htmlFor="pagina">
          Em qual página? <span className={styles.opcional}>(opcional)</span>
        </label>
        <input
          id="pagina"
          name="pagina"
          type="text"
          maxLength={LIMITES.pagina}
          placeholder="Ex.: Inflação em 12 meses"
          defaultValue={valor("pagina")}
          aria-invalid={invalido("pagina")}
          aria-describedby={erro?.campo === "pagina" ? "erro-pagina" : undefined}
        />
        {mensagem("pagina")}
      </div>

      <div className={styles.campo}>
        <label htmlFor="fonte">
          Link da fonte que mostra o valor certo <span className={styles.opcional}>(opcional)</span>
        </label>
        <input
          id="fonte"
          name="fonte"
          type="url"
          inputMode="url"
          maxLength={LIMITES.fonte}
          placeholder="https://"
          defaultValue={valor("fonte")}
          aria-invalid={invalido("fonte")}
          aria-describedby={erro?.campo === "fonte" ? "erro-fonte" : undefined}
        />
        {mensagem("fonte")}
      </div>

      {erro && !erro.campo ? (
        <p className={styles.erro} role="alert">
          {erro.mensagem}
        </p>
      ) : null}

      <button type="submit" className={styles.enviar} disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar reporte"}
      </button>
    </form>
  );
}
