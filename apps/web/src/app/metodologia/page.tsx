import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getIndicatorView, listIndicatorSlugs } from "@/lib/data";
import { getMandatos } from "@/lib/governos";

export const metadata: Metadata = { title: "Metodologia" };

async function IndicatorList() {
  const slugs = await listIndicatorSlugs();
  const views = await Promise.all(slugs.map((s) => getIndicatorView(s)));
  return (
    <ul>
      {views.map((v) =>
        v ? (
          <li key={v.indicator.slug}>
            <Link href={`/metodologia/${v.indicator.slug}`} className="toque">{v.indicator.titulo}</Link>
          </li>
        ) : null,
      )}
    </ul>
  );
}

async function CreditosFotos() {
  const mandatos = await getMandatos();
  const porFoto = new Map<string, { rotulos: string[]; foto: (typeof mandatos)[number]["foto"] }>();
  for (const m of mandatos) {
    const c = porFoto.get(m.foto.pagina);
    if (c) c.rotulos.push(m.rotulo);
    else porFoto.set(m.foto.pagina, { rotulos: [m.rotulo], foto: m.foto });
  }
  return (
    <ul>
      {[...porFoto.values()].map(({ rotulos, foto }) => (
        <li key={foto.pagina}>
          {rotulos.join(" e ")}:{" "}
          <a href={foto.pagina} rel="noopener">
            {foto.autor}
          </a>
          , {foto.licenca}
        </li>
      ))}
    </ul>
  );
}

export default function MethodologyIndex() {
  return (
    <div className="container section">
      <div className="prose">
        <h1 className="display">Metodologia</h1>
        <p className="body-lg">
          Só usamos dados de órgãos públicos que produzem o dado. Todo número mostra a fonte, a data de referência, a
          data de atualização e a frequência. Nenhum número é gerado ou estimado por inteligência artificial.
        </p>
        <h2 id="governos">Governos</h2>
        <p>
          Cada página de mandato mostra os mesmos indicadores em dois pontos. Antes da posse: o último período que terminou
          antes do dia da posse. Fim do mandato: o último período que terminou até o último dia do mandato; no mandato em
          curso, o último período já divulgado. A diferença é em pontos percentuais (p.p.) para taxas e em % para valores.
          A linha de cada cartão liga os dois pontos passando por todos os períodos entre eles. A diferença entre os dois
          números não prova que o governo causou a mudança.
        </p>
        <p>
          Só entram mandatos com todos os indicadores antes da posse e no fim; o oBrasa não usa outra pesquisa para
          preencher uma lacuna. Por isso a aba começa em 2003: a dívida líquida do setor público só existe desde dezembro
          de 2001 e o resultado primário desde novembro de 2002 (Banco Central). Desocupação (PNAD Contínua, desde 2012) e
          dívida bruta (desde dezembro de 2006) ficam fora porque não cobrem todos os mandatos.
        </p>
        <p>
          Valores em reais são corrigidos pelo IPCA ao mês mais recente divulgado. Selic: taxa efetiva do mês em termos
          anuais (série 4189 do Banco Central), a mesma régua para todos os mandatos. Resultado primário com o sinal do
          resultado: valor negativo é déficit. As datas de cada mandato são conferidas no art. 82 da Constituição, na
          versão que valia na posse, e, para 2016, na página da Denúncia 1/2016 no Senado Federal.
        </p>
        <p>
          Meta de inflação: fixada pelo Conselho Monetário Nacional (CMN) com até três anos de antecedência, por isso a
          resolução citada pode ser de um governo anterior. A carta aberta é escrita pelo presidente do Banco Central ao
          CMN quando a inflação do ano fica fora do intervalo de tolerância. Desde 2025 a meta é contínua: vale para a
          inflação acumulada em 12 meses, verificada todo mês, e a tabela anual do Banco Central não registra esses anos;
          o gráfico mostra o IPCA de dezembro em 12 meses para comparação com os anos anteriores.
        </p>
        <p>
          Leis e emendas do período: todas as emendas à Constituição e leis complementares com data de assinatura
          entre o primeiro e o último dia do mandato, da lista de legislação do Senado Federal; a lista só é atualizada
          quando a numeração de cada tipo vem completa, sem número faltando. O texto é a ementa oficial, sem resumo.
          Uma norma é marcada como “Impostos” quando a ementa cita tributo, imposto, contribuição ou o nome de um
          tributo (ICMS, ISS, IPI, IBS, CBS, Simples Nacional); a regra é a mesma para todos os mandatos e não há
          escolha caso a caso. Emendas são promulgadas pelo Congresso, sem sanção presidencial.
        </p>
        <h3 id="planos">Planos de governo</h3>
        <p>
          Desde a eleição de 2010, o TSE publica o plano de governo registrado por cada candidatura a presidente. A página
          do mandato usa o plano da chapa eleita, identificada no arquivo de candidaturas do TSE. Entra todo trecho em que
          o plano promete algo com um número: meta, quantidade, valor ou prazo. Número que é só referência (lei, ano de um
          acordo) e diagnóstico do passado ficam de fora. Um modelo de IA lê o plano e copia esses trechos; o código confere
          que cada um existe, palavra por palavra, na página citada do PDF, e recusa a leitura inteira se um trecho não
          bater. O modelo não resume nem reescreve, e o oBrasa não diz se a promessa foi cumprida. Quando o trecho é da área
          de um dos indicadores da página, o card leva até ele. A leitura é refeita só se o PDF, as instruções ou o modelo
          mudarem. Viu um trecho faltando ou fora do critério? <Link href="/reportar-erro">Reporte o erro</Link>.
        </p>
        <p>
          Mandatos de eleições anteriores a 2010 aparecem sem esse bloco, porque o TSE não guarda os planos. Michel Temer
          assumiu como vice da chapa eleita em 2014; o plano daquela chapa aparece na página de Dilma 2.
        </p>
        <h3 id="fotos">Fotos dos mandatos</h3>
        <p>
          O retrato oficial de cada mandato, publicado pela Presidência ou pela Agência Brasil e guardado no Wikimedia
          Commons; sem retrato próprio, o mais recente da pessoa até a posse. As fotos são carregadas do Wikimedia, sem
          cópia. Autor e licença:
        </p>
        <Suspense fallback={<p>Carregando…</p>}>
          <CreditosFotos />
        </Suspense>
        <h2>Metodologia por indicador</h2>
        <Suspense fallback={<p>Carregando…</p>}>
          <IndicatorList />
        </Suspense>
      </div>
    </div>
  );
}
