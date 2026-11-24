import { buildBury } from "@/lib/server/bury";

/** POST /api/bury { wallet, accounts? } : les transactions à signer (burn + close + 5 %). */
export const maxDuration = 60;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { wallet?: string; accounts?: string[] } | null;
  const wallet = body?.wallet?.trim() ?? "";
  if (!B58.test(wallet)) return Response.json({ error: "Bad wallet" }, { status: 400 });
  const accounts = Array.isArray(body?.accounts) ? body!.accounts!.filter((a) => typeof a === "string" && B58.test(a)) : null;
  try {
    return Response.json(await buildBury(wallet, accounts), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("bury", e);
    return Response.json({ error: /Nothing|None of/.test(msg) ? msg : "The lab could not prepare the burial. Try again." }, { status: 400 });
  }
}
