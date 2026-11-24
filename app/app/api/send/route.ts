import { sendAll } from "@/lib/server/send";

/** POST /api/send { txs: base64 signées[], lastValidBlockHeight } : diffuse et renvoie l'état de chacune. */
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { txs?: string[]; lastValidBlockHeight?: number } | null;
  const txs = Array.isArray(body?.txs) ? body!.txs!.filter((t) => typeof t === "string").slice(0, 40) : [];
  if (!txs.length || typeof body?.lastValidBlockHeight !== "number") return Response.json({ error: "Nothing to send" }, { status: 400 });
  try {
    return Response.json({ states: await sendAll(txs, body.lastValidBlockHeight) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("send", e);
    return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 400 });
  }
}
