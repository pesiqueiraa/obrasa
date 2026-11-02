import { describe, expect, it } from "vitest";
import { cabecalhosDeSeguranca, csp } from "./seguranca";

describe("cabeçalhos de segurança", () => {
  it("produção: só o próprio site, sem eval, com HSTS", () => {
    const c = csp(false);
    expect(c).toContain("default-src 'self'");
    expect(c).toContain("frame-ancestors 'none'");
    expect(c).toContain("connect-src 'self';");
    expect(c).not.toContain("unsafe-eval");
    expect(c).toContain("upgrade-insecure-requests");
    expect(cabecalhosDeSeguranca(false).map((h) => h.key)).toContain("Strict-Transport-Security");
  });

  it("script de outro domínio não entra", () => {
    const script = csp(false).split("; ").find((d) => d.startsWith("script-src"));
    expect(script).toBe("script-src 'self' 'unsafe-inline'");
  });

  it("fotos das notícias (regra 7): imagem https de qualquer domínio", () => {
    expect(csp(false)).toContain("img-src 'self' data: blob: https:");
  });

  it("desenvolvimento: eval e websocket do recarregamento, sem HSTS", () => {
    expect(csp(true)).toContain("'unsafe-eval'");
    expect(csp(true)).toContain("connect-src 'self' ws:");
    expect(cabecalhosDeSeguranca(true).map((h) => h.key)).not.toContain("Strict-Transport-Security");
  });
});
