"use client";

// Botão de compartilhar. No celular abre a folha de compartilhamento do sistema (WhatsApp,
// mensagens…); onde ela não existe, copia o endereço da página. Compartilha só o título e
// o endereço, nunca um número: quem abre o link vê o número com fonte e data na página.
// Usa o endereço do momento do clique, que na calculadora já traz a conta (?v=…&base=…).

import { useState } from "react";
import styles from "./ui.module.scss";

export function Compartilhar({ titulo, className }: { titulo: string; className?: string }) {
  const [aviso, setAviso] = useState("");

  async function compartilhar() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${titulo} · oBrasa`, url });
      } catch {
        // a pessoa fechou a folha de compartilhamento: nada a fazer
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado");
    } catch {
      setAviso("Não foi possível copiar. Copie o endereço na barra do navegador.");
    }
    window.setTimeout(() => setAviso(""), 4000);
  }

  return (
    <div className={`${styles.compartilhar} ${className ?? ""}`}>
      <button type="button" onClick={compartilhar}>
        Compartilhar
      </button>
      <span role="status" className={styles.compartilharAviso}>
        {aviso}
      </span>
    </div>
  );
}
