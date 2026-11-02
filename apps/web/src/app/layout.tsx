import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import "../styles/tokens.css";
import "./globals.scss";

export const metadata: Metadata = {
  title: { default: "Brasilado", template: "%s · Brasilado" },
  description: "Dados oficiais do Brasil, com contexto e sem lado.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
