import type { Metadata, Viewport } from "next";
import { ViewTransition } from "react";
import { MotionRoot } from "@/components/MotionRoot";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import "../styles/tokens.css";
import "./globals.scss";

export const metadata: Metadata = {
  // Endereço público do site, para os links das imagens de compartilhamento (og:image).
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "oBrasa", template: "%s · oBrasa" },
  description: "Dados oficiais do Brasil, com contexto e sem lado.",
};

// Cor da barra do navegador no celular: o fundo do site (DESIGN.md, `canvas`).
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        <MotionRoot>
          <SiteHeader />
          <main id="conteudo">
            {/* Troca de tema (DESIGN.md, "Movimento"): só o conteúdo desliza; o cabeçalho fica. */}
            <ViewTransition default="none" update={{ "tema-avanca": "desliza-avanca", "tema-volta": "desliza-volta", default: "none" }}>
              {children}
            </ViewTransition>
          </main>
          <SiteFooter />
        </MotionRoot>
      </body>
    </html>
  );
}
