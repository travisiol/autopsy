import { autopsy } from "@/lib/server/scan";

/** GET /api/autopsy?wallet=<adresse> : l'autopsie d'un wallet (lecture seule, n'importe quelle adresse). */
export const maxDuration = 60;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet")?.trim() ?? "";
  if (!B58.test(wallet)) return Response.json({ error: "That does not look like a Solana address." }, { status: 400 });
  try {
    return Response.json(await autopsy(wallet), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("autopsy", e);
    return Response.json({ error: "The lab could not read this wallet. Try again in a moment." }, { status: 502 });
  }
}
