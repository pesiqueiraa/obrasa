// Validação do formulário "Reportar erro" (app/reportar-erro). Mesmos limites da tabela
// `reportes` (supabase/migrations/20261113000000_reportes.sql), conferidos antes de
// chamar o banco para a mensagem de erro sair no campo certo.

export const LIMITES = { pagina: 300, descricaoMin: 10, descricao: 2000, fonte: 500 };
/** Tempo mínimo entre abrir a página e enviar: robôs enviam na hora. */
export const TEMPO_MINIMO_MS = 3000;

export type Campo = "pagina" | "descricao" | "fonte";

export type Estado =
  | { tipo: "inicio" }
  | { tipo: "erro"; campo?: Campo; mensagem: string; valores: Record<Campo, string> }
  | { tipo: "enviado"; numero: number };

export type Validacao =
  | { ok: true; dados: { pagina: string; descricao: string; fonte: string } }
  | { ok: false; campo?: Campo; mensagem: string; robo?: boolean };

export function valida(form: FormData, agora: number): Validacao {
  const texto = (k: string) => String(form.get(k) ?? "").trim();
  const pagina = texto("pagina");
  const descricao = texto("descricao");
  const fonte = texto("fonte");
  const aberto = Number(form.get("aberto_em") || 0); // vazio: a página não terminou de abrir

  // Campo isca (escondido de quem usa o site) preenchido, ou envio rápido demais: robô.
  if (texto("site") !== "" || !(aberto > 0) || agora - aberto < TEMPO_MINIMO_MS) {
    return { ok: false, robo: true, mensagem: "Não foi possível enviar. Espere alguns segundos e tente de novo." };
  }
  if (descricao.length < LIMITES.descricaoMin) {
    return { ok: false, campo: "descricao", mensagem: "Descreva o erro com pelo menos 10 caracteres." };
  }
  if (descricao.length > LIMITES.descricao) {
    return { ok: false, campo: "descricao", mensagem: `Use no máximo ${LIMITES.descricao} caracteres.` };
  }
  if (pagina.length > LIMITES.pagina) {
    return { ok: false, campo: "pagina", mensagem: `Use no máximo ${LIMITES.pagina} caracteres.` };
  }
  if (fonte && (fonte.length > LIMITES.fonte || !/^https?:\/\/\S+$/.test(fonte))) {
    return { ok: false, campo: "fonte", mensagem: "Cole um endereço que comece com https://" };
  }
  return { ok: true, dados: { pagina, descricao, fonte } };
}
