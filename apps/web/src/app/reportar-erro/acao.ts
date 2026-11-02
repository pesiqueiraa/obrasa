"use server";

// Envio do formulário "Reportar erro": valida (lib/reportes.ts) e chama a função
// `registra_reporte` do banco, a única coisa que a chave anônima pode fazer com reportes.

import { client } from "@/lib/data";
import { type Estado, valida } from "@/lib/reportes";

export async function enviaReporte(_anterior: Estado, form: FormData): Promise<Estado> {
  const valores = {
    pagina: String(form.get("pagina") ?? ""),
    descricao: String(form.get("descricao") ?? ""),
    fonte: String(form.get("fonte") ?? ""),
  };
  const v = valida(form, Date.now());
  if (!v.ok) return { tipo: "erro", campo: v.campo, mensagem: v.mensagem, valores };

  const { data, error } = await client().rpc("registra_reporte", {
    p_pagina: v.dados.pagina,
    p_descricao: v.dados.descricao,
    p_fonte: v.dados.fonte,
  });
  if (error || typeof data !== "number") {
    const limite = error?.message.includes("limite de reportes");
    return {
      tipo: "erro",
      mensagem: limite
        ? "Recebemos muitos reportes na última hora. Tente de novo mais tarde."
        : "Não foi possível enviar agora. Tente de novo em alguns minutos.",
      valores,
    };
  }
  return { tipo: "enviado", numero: data };
}
