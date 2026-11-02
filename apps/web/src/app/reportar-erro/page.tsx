import type { Metadata } from "next";
import Link from "next/link";
import { FormularioReporte } from "@/components/FormularioReporte";

export const metadata: Metadata = { title: "Reportar erro" };

export default function ReportErrorPage() {
  return (
    <div className="container section">
      <div className="prose">
        <h1 className="display">Reportar erro</h1>
        <p className="body-lg">
          Viu um número diferente do que a fonte oficial publica, ou um texto que não descreve o dado? Conte aqui.
          Toda correção feita a partir de um reporte entra no <Link href="/correcoes">registro público de
          correções</Link>, com a data e o que mudou.
        </p>
        <p>
          Não pedimos nome nem e-mail, e não guardamos nada que identifique quem reportou (
          <Link href="/privacidade">privacidade</Link>).
        </p>
      </div>
      <FormularioReporte />
    </div>
  );
}
