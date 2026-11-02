"""Notícias: leitura dos feeds, regra 7 (só título, link, data e trecho curto) e temas.

Os XML abaixo reproduzem, em miniatura, os formatos vistos nos feeds em 02/11/2026:
link de contagem de cliques da Folha, prefixo sem declaração (Revista Oeste) e feed sem
declaração XML em ISO-8859-1 (UOL).
"""

from datetime import UTC, datetime

import pytest

from pipelines import config
from pipelines.jobs.noticias import Classificador, normaliza, veiculo_do_link
from pipelines.models import ValidationError
from pipelines.sources import rss

RSS = (
    b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>X</title>
<item><title>Copom mant\xc3\xa9m a Selic</title>
  <link>https://redir.folha.com.br/redir/online/rss091/*https://www1.folha.uol.com.br/mercado/2026/11/copom.shtml?utm_source=rss#x</link>
  <pubDate>Sun, 01 Nov 2026 21:55:00 -0300</pubDate>
  <description><![CDATA[<p>O <b>Banco Central</b> manteve a taxa. """
    + b"texto " * 80
    + b"""</p>]]></description>
  <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/">CORPO DA MATERIA</content:encoded>
</item>
<item><title>Prefeitura anuncia obra</title>
  <link>https://www1.folha.uol.com.br/especial-publicitario/obra.shtml</link>
  <pubDate>Sun, 01 Nov 2026 20:00:00 -0300</pubDate></item>
<item><title>Link de outro site</title><link>https://exemplo.com/a</link>
  <pubDate>Sun, 01 Nov 2026 20:00:00 -0300</pubDate></item>
<item><title>Sem data</title><link>https://www1.folha.uol.com.br/b.shtml</link></item>
</channel></rss>"""
)


def test_rss_so_titulo_link_data_e_trecho_curto():
    itens = rss.parse(RSS, "folha.uol.com.br", 200)
    assert len(itens) == 1  # publicidade, link de fora e item sem data ficam de fora
    it = itens[0]
    assert it.url == "https://www1.folha.uol.com.br/mercado/2026/11/copom.shtml"
    assert it.titulo == "Copom mantém a Selic"
    assert it.publicado_em == datetime(2026, 11, 2, 0, 55, tzinfo=UTC)
    assert it.trecho.startswith("O Banco Central manteve a taxa.")
    assert len(it.trecho) <= 200 and it.trecho.endswith("…")
    assert "CORPO" not in it.trecho  # content:encoded nunca é lido


def test_prefixo_sem_declaracao_e_iso_8859_1():
    oeste = (
        b'<?xml version="1.0"?><rss version="2.0"><channel><item><title>A</title>'
        b"<link>https://revistaoeste.com/politica/a/</link>"
        b"<pubDate>Sun, 01 Nov 2026 10:00:00 +0000</pubDate>"
        b'<media:content url="x"/><post-id xmlns="com-wordpress:feed-additions:1">1</post-id>'
        b"</item></channel></rss>"
    )
    assert rss.parse(oeste, "revistaoeste.com", 200)[0].titulo == "A"
    uol = (
        "<rss><channel><item><title>Educação básica</title>"
        "<link>https://noticias.uol.com.br/a.htm</link>"
        "<pubDate>Sun, 01 Nov 2026 10:00:00 -0300</pubDate></item></channel></rss>"
    ).encode("iso-8859-1")
    it = rss.parse(uol, "uol.com.br", 200, "text/xml;charset=ISO-8859-1")
    assert it[0].titulo == "Educação básica"


def test_atom_e_feed_invalido():
    atom = (
        b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>T</title>'
        b'<link rel="alternate" href="https://www.bbc.com/portuguese/articles/x?at_medium=RSS"/>'
        b"<published>2026-11-01T10:00:00Z</published><summary>S</summary></entry></feed>"
    )
    it = rss.parse(atom, "bbc.com", 200)[0]
    assert it.url == "https://www.bbc.com/portuguese/articles/x"
    with pytest.raises(ValidationError):
        rss.parse(b"<!doctype html><html></html>", "uol.com.br", 200)


def test_xml_com_entidade_externa_e_recusado():
    bomba = (
        b'<?xml version="1.0"?><!DOCTYPE r [<!ENTITY e SYSTEM "file:///etc/passwd">]>'
        b"<rss><channel><item><title>&e;</title></item></channel></rss>"
    )
    with pytest.raises(Exception):  # noqa: B017 - defusedxml recusa entidades
        rss.parse(bomba, "x.com", 200)


# --- temas e veículos ---

CFG = config.load_noticias()


def test_temas_por_termos_sem_acento_e_palavra_inteira():
    cl = Classificador(CFG)
    assert cl.temas("Copom mantém Selic em 15%", None) == ["economia"]
    assert cl.temas("Inflacao desacelera", None) == ["economia"]  # sem acento também vale
    assert cl.temas("Falta uma semana para o Enem 2026", None) == ["educacao"]
    assert cl.temas("Juros sobem e desemprego cai", None) == ["economia", "trabalho"]
    assert cl.temas("Campeonato de futebol", "jogo de domingo") == []
    assert normaliza("Educação") == "educacao"


def test_opiniao_e_noticia_de_outro_pais_ficam_de_fora():
    cl = Classificador(CFG)
    assert cl.temas("Juros e o futuro", None, "https://oglobo.globo.com/opiniao/x") == []
    assert cl.temas("Inflação nos EUA acelera", None, "https://valor.globo.com/mundo/x") == []


def test_veiculo_mais_especifico_vence():
    v = veiculo_do_link("https://www1.folha.uol.com.br/poder/a.shtml", CFG.veiculos)
    assert v is not None and v.id == "folha"
    v = veiculo_do_link("https://noticias.uol.com.br/a.htm", CFG.veiculos)
    assert v is not None and v.id == "uol"
    assert veiculo_do_link("https://exemplo.com/a", CFG.veiculos) is None


def test_config_noticias():
    assert CFG.trecho_max <= 300
    ids = [v.id for v in CFG.veiculos]
    assert ids == sorted(ids)
    with pytest.raises(ValueError, match="trecho curto"):
        config.Noticias(**{**CFG.model_dump(), "trecho_max": 1000})


def test_imagem_do_feed_sem_logotipo_nem_pixel():
    item = (
        "<item><title>{t}</title><link>https://agenciabrasil.ebc.com.br/{t}</link>"
        "<pubDate>Sun, 01 Nov 2026 10:00:00 -0300</pubDate>{extra}</item>"
    )
    pixel = (
        '<description><![CDATA[<img src="https://x.com/logo.svg"> Texto'
        '<img src="https://agenciabrasil.ebc.com.br/ebc.png?id=1" style="width:1px"/>]]>'
        "</description>"
    )
    corpo = "".join(
        [
            item.format(
                t="a",
                extra="<imagem-destaque>https://imagens.ebc.com.br/a.jpg</imagem-destaque>" + pixel,
            ),
            item.format(t="b", extra='<enclosure url="http://img.com/b.jpg" type="image/jpeg"/>'),
            item.format(
                t="c",
                extra='<media:content xmlns:media="http://search.yahoo.com/mrss/" url="https://i.com/rep.jpg" medium="image"/>',
            ),
            item.format(
                t="d",
                extra='<media:content xmlns:media="http://search.yahoo.com/mrss/" url="https://i.com/rep.jpg" medium="image"/>',
            ),
            item.format(
                t="e",
                extra='<media:content xmlns:media="http://search.yahoo.com/mrss/" url="https://i.com/rep.jpg" medium="image"/>',
            ),
            item.format(t="f", extra=pixel),
        ]
    )
    feed = f"<rss><channel>{corpo}</channel></rss>".encode()
    img = {i.titulo: i.imagem for i in rss.parse(feed, "agenciabrasil.ebc.com.br", 200)}
    assert img["a"] == "https://imagens.ebc.com.br/a.jpg"
    assert img["b"] == "https://img.com/b.jpg"  # sempre https
    assert img["c"] is None  # a mesma imagem em 3 itens é logotipo, não foto
    assert img["f"] is None  # logotipo e pixel de contagem ficam de fora
