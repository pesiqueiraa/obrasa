import type { Metadata } from "next";

export const metadata: Metadata = { title: "Quem financia" };

export default function FundingPage() {
  return (
    <div className="container section">
      <div className="prose">
        <h1 className="display">Quem financia</h1>
        <p className="body-lg">
          O Brasilado ainda não recebe dinheiro de ninguém. A forma de financiamento está em discussão e será publicada
          aqui antes do lançamento, com valores e origem.
        </p>
        <p>Não aceitamos dinheiro de partidos, candidatos ou campanhas, nem anúncio político.</p>
      </div>
    </div>
  );
}
