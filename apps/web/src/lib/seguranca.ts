// Cabeçalhos de segurança de todas as respostas (next.config.ts, headers()).
//
// CSP: só recursos do próprio site, com duas exceções.
// - img-src https: as fotos das notícias vêm do endereço de cada veículo e nunca são
//   copiadas para o nosso servidor (regra 7). Os domínios das fotos mudam com o CDN de
//   cada veículo, então a regra aceita qualquer https, só para imagem.
// - script-src 'unsafe-inline': o Next injeta scripts inline para montar a página. A
//   alternativa (nonce por requisição) obrigaria toda página a ser gerada a cada visita,
//   sem o cache que serve os dados (cacheComponents). Scripts de outros domínios
//   continuam bloqueados.
// style-src 'unsafe-inline': atributos style do React (ex.: largura das barras).
// Em desenvolvimento o React precisa de eval e o servidor de recarga usa websocket.

export type Cabecalho = { key: string; value: string };

export function csp(dev: boolean): string {
  const diretivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(dev ? ["ws:"] : [])],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const texto = Object.entries(diretivas).map(([k, v]) => `${k} ${v.join(" ")}`);
  return [...texto, ...(dev ? [] : ["upgrade-insecure-requests"])].join("; ");
}

export function cabecalhosDeSeguranca(dev: boolean): Cabecalho[] {
  return [
    { key: "Content-Security-Policy", value: csp(dev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}
