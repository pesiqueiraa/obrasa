import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("check_terms", ROOT / "scripts" / "check_terms.py")
check_terms = importlib.util.module_from_spec(spec)
sys.modules["check_terms"] = check_terms
spec.loader.exec_module(check_terms)
RULES = check_terms.load_rules(ROOT / "config" / "forbidden_terms.yaml")


def hits(text: str, rel: str = "apps/web/src/x.tsx") -> list[str]:
    return [h.match.lower() for h in check_terms.check_text(text, rel, RULES)]


def test_flags_terms_from_language_guide():
    assert hits("Inflação dispara em outubro") == ["dispara"]
    assert hits("Arrecadação despencou") == ["despencou"]
    assert hits("Rombo nas contas") == ["rombo"]
    assert hits("Recorde histórico") == ["recorde"]
    assert hits("O governo gastou demais") == ["gastou demais"]
    assert hits("Número alarmante") == ["alarmante"]


def test_neutral_verbs_pass():
    assert hits("Em 12 meses, os preços subiram em média 4,58%.") == []
    assert hits("▼ cai 5,67 p.p. em 5 anos") == []
    assert hits("fica estável em 12 meses") == []
    assert hits("Histórico de revisões") == []


def test_exclamation_only_in_templates():
    assert hits("A inflação subiu 1%!", "config/templates/x.txt") == ["!"]
    assert hits("if (!view) notFound();") == []
    assert hits("# comentário!", "config/templates/x.txt") == []


def test_allow_marker():
    assert hits("recorde  // termos-ok: citação de docs") == []


def test_repository_is_clean():
    assert check_terms.main(ROOT) == 0
