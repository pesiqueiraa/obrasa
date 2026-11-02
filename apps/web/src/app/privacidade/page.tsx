import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <div className="container section">
      <div className="prose">
        <h1 className="display">Privacidade</h1>
        <p className="body-lg">
          O oBrasa não tem cadastro nem login, não usa cookies e não guarda nada no seu navegador. Não usamos
          ferramenta de anúncio nem de rastreamento.
        </p>

        <h2>O que fica registrado</h2>
        <ul>
          <li>
            <strong>Hospedagem.</strong> O servidor que entrega o site (Vercel) registra dados técnicos de cada
            acesso, como endereço IP, navegador e página pedida, para segurança e funcionamento. Esses registros
            seguem a política da empresa de hospedagem e não são cruzados com nenhum outro dado.
          </li>
          <li>
            <strong>Fotos das notícias.</strong> As fotos das notícias são carregadas do endereço de cada veículo,
            nunca copiadas para o nosso servidor. Ao abrir uma página com foto, o seu navegador acessa o servidor do
            veículo, que recebe o seu endereço IP. Pedimos ao navegador que não informe ao veículo de qual página do
            oBrasa a foto foi pedida.
          </li>
          <li>
            <strong>Links para fora.</strong> Ao clicar numa notícia ou numa fonte oficial, você sai do oBrasa e
            passa a seguir a política do outro site.
          </li>
        </ul>

        <h2>Reportar erro</h2>
        <p>
          O <Link href="/reportar-erro">formulário de reporte</Link> guarda só o que você escreve nele (o erro, a página
          e o link da fonte, se informar) e a data do envio. Não pede nome nem e-mail e não guarda o seu endereço IP.
          O texto não é publicado: só a equipe do oBrasa lê, para conferir na fonte oficial. Se houver erro, a correção
          sai na página de <Link href="/correcoes">Correções</Link>, sem o texto do reporte. Não escreva dados
          pessoais no formulário.
        </p>
      </div>
    </div>
  );
}
