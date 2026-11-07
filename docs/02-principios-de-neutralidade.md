# 02 · Princípios de neutralidade

Neutralidade aqui é regra de produto, não intenção. Cada princípio abaixo vira critério de aceite: um pull request que exibe dado ou texto sem cumprir estas regras não deve ser aprovado.

## 1. Só fonte oficial primária

- Fontes aceitas são os órgãos públicos que **produzem** o dado: Banco Central, IBGE, Tesouro Nacional, Receita Federal, CGU, Câmara, Senado, TSE, IFI. A lista completa está em [05](05-fontes-de-dados.md).
- Quando um órgão apenas republica o dado de outro, a fonte primária tem preferência. Exemplo: o IPCA é produzido pelo IBGE e republicado pelo Banco Central. Usamos o IBGE como fonte principal e o Banco Central como reserva.
- Agregadores como a Base dos Dados podem ser usados como atalho técnico, mas a tela sempre cita e linka a fonte primária.
- Todo gráfico tem link para o dado bruto e para a página de metodologia da fonte.

## 2. Nominal e real, sempre

- Toda série em reais é mostrada em valores reais (corrigidos pelo IPCA), com o mês-base escrito na tela. Exemplo: "a preços de setembro de 2026".
- O usuário pode alternar para valores nominais.
- Quando ajudar a leitura, mostrar também per capita (população do IBGE) ou percentual do PIB.

## 3. Mesma régua para todo governo

- Janelas de tempo padrão: **12 meses, 5 anos, 10 anos e série completa**. Nenhuma tela usa janela escolhida caso a caso.
- Comparações entre mandatos usam períodos completos e equivalentes.
- Se um gráfico marca o início de um mandato, marca o de todos os mandatos da série, sem exceção.
- Mudança de metodologia na fonte aparece marcada no gráfico. Exemplo: a dívida bruta do governo geral tem uma série até 2007 e outra a partir de 2008.

## 4. Linguagem sem adjetivo

| Evitar | Usar |
|---|---|
| explode, dispara | sobe X% em Y meses |
| despenca, desaba | cai X% em Y meses |
| rombo | déficit de R$ X bilhões |
| recorde (sem dizer a base) | maior valor da série iniciada em AAAA |
| o governo gastou demais | a despesa cresceu X% acima da inflação em 12 meses |

- Verbos neutros: sobe, cai, fica estável.
- Todo número vem com unidade e período.
- Nada de pontos de exclamação em textos sobre dados.
- O ideal é ter uma lista de termos proibidos no código, verificada automaticamente nos textos da interface e em qualquer resumo gerado.

## 5. Frequência e data à vista

Cada indicador exibe:
- data de referência (o período que o número descreve);
- data da coleta ou divulgação;
- frequência da fonte (diária, mensal, trimestral…);
- data da próxima divulgação, quando a fonte publica calendário.

"Tempo real" só vale para dado que de fato muda em tempo real. Contadores animados que interpolam valores entre divulgações estão proibidos. Se algum dia forem usados, precisam de um rótulo claro de "estimativa".

## 6. Método e código abertos

- O código do projeto é público (a licença está em aberto: [08](08-decisoes-em-aberto.md), D8).
- Cada indicador tem uma página de metodologia: fonte, série, transformações aplicadas e fórmula.
- Registro público de correções: data, o que estava errado e o que mudou.

## 7. Dinheiro às claras

- Página "Quem financia", sempre atualizada.
- Não aceitar dinheiro de partidos, candidatos ou campanhas.
- Sem anúncio político.

## 8. Cor também tem lado

- A identidade visual não usa verde-amarelo nem vermelho como cores dominantes. No Brasil de hoje, essas cores têm leitura partidária.
- Em gráficos, nenhum governo ou partido é associado a uma cor partidária.
- Alta e baixa se comunicam por forma e rótulo, não só por cor.

## 9. Lei é fonte; projeto é proposta

- Regra de imposto na tela cita a lei, o artigo e o link para o texto compilado no Planalto. Sem artigo, a regra não entra.
- O que ainda tramita aparece separado do que já é lei, com o selo "Proposta, não é lei" e a situação atual informada pela Câmara ou pelo Senado.
- A linha do tempo diz o que muda e quando, com os números da lei: "a alíquota passa de X% para Y%", nunca "aumento" ou "alívio" sem o número.
- Simulação ou estimativa tem o rótulo escrito e o aviso de que não substitui orientação contábil ([07](07-riscos-e-cuidados.md), R9).

## 10. Promessas e mandatos

O oBrasa **não avalia se uma promessa foi cumprida**. Mostra o que foi dito ao lado do dado oficial, e a pessoa tira a conclusão.

- **Só o que foi registrado.** A promessa é citada literalmente a partir do plano de governo entregue ao TSE, com página e link para o PDF. Discurso, entrevista e rede social ficam de fora.
- **Ligação feita por pessoa, em arquivo público.** Qual indicador acompanha qual promessa é decidido por uma pessoa e registrado num arquivo versionado do repositório, como os termos das notícias. Nenhum modelo de IA escolhe a ligação nem resume a promessa. Qualquer leitor pode contestar pelo formulário de erro.
- **Promessa sem número não ganha indicador.** Aparece só o texto citado.
- **Sem veredito.** Não há selo de "cumpriu", "não cumpriu", nota, ranking, semáforo ou percentual de promessas cumpridas.
- **Mesma régua para todos.** O mesmo formato vale para o presidente e para os 27 governadores, sem escolher quem acompanhar. O ponto de partida é o último dado antes da posse; os indicadores aparecem na ordem do plano, com o mesmo destaque, melhorem ou piorem.
- **O resultado não é atribuído ao governante.** A tela diz o que o indicador mostra, não que o governo causou a mudança.
- **Parlamentares:** não registram plano. Para eles só vale o registro do mandato (votos, presença, projetos, cota e emendas), no mesmo formato para todos e sem nota.

## Checklist de pull request

Copie para o template de PR do repositório:

```markdown
- [ ] Todo número na tela vem do banco e tem `series_id` rastreável até a fonte.
- [ ] Fonte (com link), data de referência, data de atualização e frequência estão visíveis.
- [ ] Série em reais mostra valor real e nominal, com mês-base explícito.
- [ ] A janela de tempo é uma das padrão (12 meses, 5 anos, 10 anos, série completa).
- [ ] Textos passaram pelo guia de linguagem e pelo verificador de termos proibidos.
- [ ] Nenhum texto gerado por IA contém número que não esteja no banco ou na fonte citada.
- [ ] Gráfico acessível: contraste, descrição em texto e tabela com os dados.
```
