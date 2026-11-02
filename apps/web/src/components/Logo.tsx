// Logotipo do oBrasa (DESIGN.md, "Logotipo"): o Cruzeiro do Sul ao lado do nome.
// As cinco estrelas estão nas posições reais, vistas do chão olhando para o sul, e o
// raio de cada ponto segue o brilho da estrela (Acrux, a mais brilhante, embaixo).
// Pontos redondos, sem as pontas da bandeira. "oBrasa" em IBM Plex Serif, com o "o"
// em azul-tinta. O nome inteiro vai no rótulo acessível.

import styles from "./ui.module.scss";

// [cx, cy, r] no viewBox 5 0 30 40. Fonte das posições: ascensão reta e declinação do
// catálogo Hipparcos, projetadas em torno do centro da constelação.
export const CRUZEIRO = [
  [20.17, 3.53, 3.1], // Gacrux (γ)
  [8.73, 17.72, 3.3], // Mimosa (β)
  [31.28, 12.55, 2.4], // δ Crucis
  [26.93, 21.62, 1.8], // ε Crucis (Intrometida)
  [23.36, 36.47, 3.7], // Acrux (α)
] as const;

export function Marca({ className }: { className?: string }) {
  return (
    <svg viewBox="5 0 30 40" className={className} aria-hidden="true" focusable="false">
      {CRUZEIRO.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`${styles.logo} ${className ?? ""}`}>
      <Marca className={styles.marca} />
      <span aria-hidden="true">
        <span className={styles.logoO}>o</span>Brasa
      </span>
      <span className="visually-hidden">oBrasa</span>
    </span>
  );
}
