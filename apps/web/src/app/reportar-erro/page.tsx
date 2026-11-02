import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reportar erro" };

export default function ReportErrorPage() {
  return (
    <div className="container section">
      <div className="prose">
        <h1 className="display">Reportar erro</h1>
        <p className="body-lg">
          O formulário de reporte ainda está em preparação. Toda correção feita a partir de um reporte entra no
          registro público de correções, com data e o que mudou.
        </p>
      </div>
    </div>
  );
}
