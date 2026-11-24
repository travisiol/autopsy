import "server-only";
import { PublicKey } from "@solana/web3.js";
import { DEAD_USD, JUPITER_API_KEY, rpc, RPC_URL, TOKEN, TOKEN22, WSOL } from "./config";

/**
 * L'autopsie d'un wallet : tous ses comptes de tokens, classés.
 * - corps (bodies) : tokens morts (valeur < 0,10 $, marché mort) et comptes vides. On peut les enterrer.
 * - miettes (crumbs) : une poussière d'un token encore vivant (WIF, actions xStock…). Pas des morts :
 *   jamais comptés dans le rapport, pas cochés par défaut, mais le joueur peut récupérer leur loyer.
 * - vivants (valeur ≥ 0,10 $) : jamais touchés.
 * - gelés, NFT, wSOL, comptes qu'on ne peut pas fermer : écartés.
 * Les données du marché viennent de Jupiter (liquidité réelle, launchpad, migration, premier pool) ;
 * la page affine ensuite la cause avec le moteur Vigil.
 */

export type Cause = "EMPTY" | "NEVER_BONDED" | "RUGGED" | "BLED_OUT" | "STILLBORN" | "DUST";

export type Body = {
  account: string;
  mint: string;
  program: "spl" | "t22";
  amount: string; // unités brutes (texte : peut dépasser 2^53)
  decimals: number;
  ui: number;
  lamports: number; // le loyer bloqué dans le compte, rendu à la fermeture
  usd: number | null;
  symbol: string | null;
  name: string | null;
  image: string | null;
  cause: Cause;
  born: number | null; // premier pool du token (ms)
};

export type Report = {
  wallet: string;
  at: number;
  bodies: Body[];
  crumbs: Body[];
  alive: { count: number; usd: number };
  skipped: { frozen: number; nft: number; locked: number };
};

type Parsed = { pubkey: PublicKey; account: { lamports: number; data: { parsed: { info: Info } } } };
type Info = {
  mint: string;
  state: string;
  closeAuthority?: string;
  tokenAmount: { amount: string; decimals: number; uiAmount: number | null };
  extensions?: { extension: string; state?: { withheldAmount?: number | string } }[];
};

type Tok = {
  id: string;
  name?: string;
  symbol?: string;
  icon?: string;
  usdPrice?: number;
  liquidity?: number;
  launchpad?: string | null;
  graduatedPool?: string | null;
  firstPool?: { createdAt?: string } | null;
  createdAt?: string;
};
type Meta = { symbol: string | null; name: string | null; image: string | null };

/** Un token qui a encore ce niveau de liquidité est vivant : ce que le joueur en garde n'est qu'une miette. */
const LIVE_LIQ = 50_000;

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function getJson(url: string, headers: Record<string, string> = {}) {
  for (let t = 0; t < 3; t++) {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(9000), cache: "no-store" }).catch(() => null);
    if (r?.ok) return r.json().catch(() => null);
    if (r && r.status !== 429 && r.status < 500) return null;
    await new Promise((res) => setTimeout(res, 500 + t * 700));
  }
  return null;
}

/** Fiche Jupiter de chaque token : prix, liquidité, launchpad, migration, premier pool, logo. */
async function jupTokens(mints: string[]): Promise<Map<string, Tok>> {
  const out = new Map<string, Tok>();
  const base = JUPITER_API_KEY ? "https://api.jup.ag/tokens/v2/search?query=" : "https://lite-api.jup.ag/tokens/v2/search?query=";
  const headers: Record<string, string> = JUPITER_API_KEY ? { "x-api-key": JUPITER_API_KEY } : {};
  await pool(chunks(mints, 100), 3, async (c) => {
    const j = (await getJson(base + c.join(","), headers)) as Tok[] | null;
    if (Array.isArray(j)) for (const t of j) if (t?.id && c.includes(t.id)) out.set(t.id, t);
  });
  return out;
}

/** Nom, symbole et image depuis les métadonnées (Helius DAS) : pour les comptes vides et les tokens inconnus de Jupiter. */
async function metas(mints: string[]): Promise<Map<string, Meta>> {
  const out = new Map<string, Meta>();
  if (!/helius/.test(RPC_URL) || !mints.length) return out;
  type Asset = { id: string; content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } }; token_info?: { symbol?: string } } | null;
  await pool(chunks(mints, 1000), 2, async (c) => {
    const r = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAssetBatch", params: { ids: c } }), signal: AbortSignal.timeout(10000) }).catch(() => null);
    const j = r?.ok ? ((await r.json().catch(() => null)) as { result?: Asset[] } | null) : null;
    for (const a of j?.result ?? []) {
      if (!a?.id) continue;
      const sym = a.content?.metadata?.symbol || a.token_info?.symbol || null;
      out.set(a.id, { symbol: sym?.trim() || null, name: a.content?.metadata?.name?.trim() || null, image: a.content?.links?.image || null });
    }
  });
  return out;
}

function causeOf(t: Tok | undefined): Cause {
  if (!t) return "STILLBORN"; // aucun marché connu
  const liq = t.liquidity ?? 0;
  if (liq >= LIVE_LIQ) return "DUST";
  if (t.launchpad && !t.graduatedPool) return "NEVER_BONDED"; // resté sur sa courbe de lancement
  if (!t.launchpad && liq < 100) return "RUGGED"; // pool classique vidé : la liquidité est partie
  return "BLED_OUT";
}

const cache = new Map<string, { at: number; rep: Report }>();

export async function autopsy(wallet: string, fresh = false): Promise<Report> {
  const hit = cache.get(wallet);
  if (!fresh && hit && Date.now() - hit.at < 30_000) return hit.rep;

  const owner = new PublicKey(wallet);
  const [a, b] = await Promise.all([
    rpc().getParsedTokenAccountsByOwner(owner, { programId: TOKEN }),
    rpc().getParsedTokenAccountsByOwner(owner, { programId: TOKEN22 }),
  ]);
  const rows = [
    ...(a.value as unknown as Parsed[]).map((v) => ({ v, program: "spl" as const })),
    ...(b.value as unknown as Parsed[]).map((v) => ({ v, program: "t22" as const })),
  ];

  const skipped = { frozen: 0, nft: 0, locked: 0 };
  const cands: { v: Parsed; program: "spl" | "t22"; info: Info }[] = [];
  for (const r of rows) {
    const info = r.v.account.data.parsed.info;
    if (info.mint === WSOL) continue; // du SOL emballé : pas un mort
    if (info.state !== "initialized") { skipped.frozen++; continue; }
    if (info.tokenAmount.decimals === 0 && info.tokenAmount.amount !== "0") { skipped.nft++; continue; } // NFT et objets : jamais
    if (info.closeAuthority && info.closeAuthority !== wallet) { skipped.locked++; continue; }
    const withheld = info.extensions?.find((e) => e.extension === "transferFeeAmount")?.state?.withheldAmount;
    if (withheld && Number(withheld) > 0) { skipped.locked++; continue; } // frais retenus : le compte ne peut pas être fermé
    cands.push({ ...r, info });
  }

  const held = [...new Set(cands.filter((c) => c.info.tokenAmount.amount !== "0").map((c) => c.info.mint))];
  const all = [...new Set(cands.map((c) => c.info.mint))];
  const [jt, md] = await Promise.all([jupTokens(held), metas(all)]);
  if (held.length && !jt.size) throw new Error("market data unavailable"); // sans prix, on ne classe rien (jamais enterrer à l'aveugle)

  const bodies: Body[] = [];
  const crumbs: Body[] = [];
  const alive = { count: 0, usd: 0 };
  for (const c of cands) {
    const t = c.info.tokenAmount;
    const ui = t.uiAmount ?? Number(t.amount) / 10 ** t.decimals;
    const tok = jt.get(c.info.mint);
    const meta = md.get(c.info.mint);
    let usd: number | null = null;
    if (t.amount !== "0") {
      usd = tok?.usdPrice ? ui * tok.usdPrice : null;
      if (usd != null && usd >= DEAD_USD) { alive.count++; alive.usd += usd; continue; }
    }
    const born = tok?.firstPool?.createdAt ? Date.parse(tok.firstPool.createdAt) : null;
    const body: Body = {
      account: c.v.pubkey.toBase58(),
      mint: c.info.mint,
      program: c.program,
      amount: t.amount,
      decimals: t.decimals,
      ui,
      lamports: c.v.account.lamports,
      usd,
      symbol: (tok?.symbol ?? meta?.symbol)?.trim() || null,
      name: (tok?.name ?? meta?.name)?.trim() || null,
      image: tok?.icon ?? meta?.image ?? null,
      cause: t.amount === "0" ? "EMPTY" : causeOf(tok),
      born: born && !Number.isNaN(born) ? born : null,
    };
    (body.cause === "DUST" ? crumbs : bodies).push(body);
  }
  // les morts d'abord, du plus ancien au plus récent ; les comptes vides à la fin
  bodies.sort((x, y) => (x.cause === "EMPTY" ? 1 : 0) - (y.cause === "EMPTY" ? 1 : 0) || (x.born ?? 9e15) - (y.born ?? 9e15));

  const rep: Report = { wallet, at: Date.now(), bodies, crumbs, alive, skipped };
  cache.set(wallet, { at: Date.now(), rep });
  if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
  return rep;
}
