// /saude: a esteira está rodando? 200 se todos os jobs rodaram no prazo e ainda entram
// notícias; 503 se não (ou se o banco não responde). Para o monitor externo (docs/06,
// "Vigia"). Sem cache: cada consulta lê o banco.

import { connection } from "next/server";
import { avalia, configSaude, leSaude } from "@/lib/saude";

export async function GET() {
  await connection();
  const semCache = { "Cache-Control": "no-store" };
  try {
    const config = await configSaude();
    const saude = avalia(config, await leSaude(config), new Date());
    return Response.json(saude, { status: saude.ok ? 200 : 503, headers: semCache });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, erro }, { status: 503, headers: semCache });
  }
}
