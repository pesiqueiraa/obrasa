"use client";

// Imagem de destaque que o feed do veículo associa à matéria, carregada direto do site
// do veículo (nunca copiada nem reprocessada por nós). Se o servidor do veículo recusar,
// a moldura some e fica só o texto.

import { useState } from "react";
import styles from "./noticias.module.scss";

export function Foto({ src, className }: { src: string; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) return null;
  return (
    <div className={`${styles.foto} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image copiaria a foto para o nosso servidor */}
      <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
    </div>
  );
}
