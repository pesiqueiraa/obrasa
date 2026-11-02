import type { Metadata } from "next";
import { MotionRoot } from "@/components/MotionRoot";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import "../styles/tokens.css";
import "./globals.scss";

export const metadata: Metadata = {
  title: { default: "oBrasa", template: "%s · oBrasa" },
  description: "Dados oficiais do Brasil, com contexto e sem lado.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        <MotionRoot>
          <SiteHeader />
          <main id="conteudo">{children}</main>
          <SiteFooter />
        </MotionRoot>
      </body>
    </html>
  );
}
