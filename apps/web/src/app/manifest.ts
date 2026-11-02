// /manifest.webmanifest: nome, cor e ícone quando alguém adiciona o site à tela inicial
// do celular. Abre no navegador comum (display "browser"): o site não é um aplicativo.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "oBrasa",
    short_name: "oBrasa",
    description: "Dados oficiais do Brasil, com contexto e sem lado.",
    lang: "pt-BR",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
