import "server-only";
import { createBurnCheckedInstruction, createCloseAccountInstruction } from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { FEE_BPS, rpc, TOKEN, TOKEN22, TREASURY } from "./config";
import { autopsy, Body } from "./scan";

/**
 * « Bury them » : prépare les transactions que le joueur signera.
 * Chaque transaction brûle ses tokens morts, ferme leurs comptes (le loyer revient au joueur)
 * et envoie 5 % de ce loyer à la trésorerie. Le serveur ne signe rien et ne détient rien.
 */

const MAX_TX = 1232;
const PER_TX = 18; // au plus 18 comptes par transaction
const PRIORITY_MICROLAMPORTS = 50_000;

export type Built = { txs: string[]; lastValidBlockHeight: number; plan: { accounts: string[]; lamports: number; fee: number }[]; dropped: string[] };

const fee = (lamports: number) => Math.floor((lamports * FEE_BPS) / 10_000);

function bodyIxs(b: Body, owner: PublicKey): TransactionInstruction[] {
  const prog = b.program === "t22" ? TOKEN22 : TOKEN;
  const acc = new PublicKey(b.account);
  const ixs: TransactionInstruction[] = [];
  if (b.amount !== "0") ixs.push(createBurnCheckedInstruction(acc, new PublicKey(b.mint), owner, BigInt(b.amount), b.decimals, [], prog));
  ixs.push(createCloseAccountInstruction(acc, owner, owner, [], prog));
  return ixs;
}

function makeTx(group: Body[], owner: PublicKey, treasury: PublicKey, blockhash: string, lastValidBlockHeight: number) {
  const lamports = group.reduce((s, b) => s + b.lamports, 0);
  const cu = 2_000 + group.reduce((s, b) => s + (b.program === "t22" ? 14_000 : 9_000), 0);
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: cu }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }));
  for (const b of group) tx.add(...bodyIxs(b, owner));
  const f = fee(lamports);
  if (f > 0) tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: treasury, lamports: f }));
  return { tx, lamports, fee: f };
}

const size = (tx: Transaction) => 1 + 64 + tx.serializeMessage().length;

/** Range les morts dans des transactions aussi pleines que possible (taille max d'une transaction Solana). */
function pack(bodies: Body[], owner: PublicKey, treasury: PublicKey, bh: string, lvbh: number) {
  const groups: Body[][] = [];
  let cur: Body[] = [];
  for (const b of bodies) {
    const next = [...cur, b];
    if (next.length > PER_TX || size(makeTx(next, owner, treasury, bh, lvbh).tx) > MAX_TX) { groups.push(cur); cur = [b]; } else cur = next;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

async function simulates(tx: Transaction) {
  const r = await rpc().simulateTransaction(tx).catch(() => null);
  return !!r && !r.value.err;
}

export async function buildBury(wallet: string, accounts: string[] | null): Promise<Built> {
  if (!TREASURY) throw new Error("Treasury not configured");
  const owner = new PublicKey(wallet);
  const treasury = new PublicKey(TREASURY);

  // on refait l'autopsie : on n'enterre que ce que le serveur voit mort maintenant, et seulement dans ce wallet
  const rep = await autopsy(wallet, true);
  const byAcc = new Map([...rep.bodies, ...rep.crumbs].map((b) => [b.account, b]));
  let pick = accounts ? accounts.map((a) => byAcc.get(a)).filter((b): b is Body => !!b) : rep.bodies;
  if (!pick.length) throw new Error("Nothing to bury");
  pick = pick.slice(0, 300); // une fournée à la fois

  const { blockhash, lastValidBlockHeight } = await rpc().getLatestBlockhash("confirmed");
  let groups = pack(pick, owner, treasury, blockhash, lastValidBlockHeight);

  // chaque transaction est simulée ; si l'une échoue, on teste ses morts un par un et on écarte ceux qui bloquent
  const dropped: string[] = [];
  const ok = await Promise.all(groups.map((g) => simulates(makeTx(g, owner, treasury, blockhash, lastValidBlockHeight).tx)));
  if (ok.some((x) => !x)) {
    const keep: Body[] = [];
    for (let i = 0; i < groups.length; i++) {
      if (ok[i]) { keep.push(...groups[i]); continue; }
      const solo = await Promise.all(groups[i].map((b) => simulates(makeTx([b], owner, treasury, blockhash, lastValidBlockHeight).tx)));
      groups[i].forEach((b, k) => (solo[k] ? keep.push(b) : dropped.push(b.account)));
    }
    groups = pack(keep, owner, treasury, blockhash, lastValidBlockHeight);
  }
  if (!groups.length) throw new Error("None of these accounts can be closed right now");

  const built = groups.map((g) => ({ g, ...makeTx(g, owner, treasury, blockhash, lastValidBlockHeight) }));
  return {
    txs: built.map((b) => b.tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64")),
    lastValidBlockHeight,
    plan: built.map((b) => ({ accounts: b.g.map((x) => x.account), lamports: b.lamports, fee: b.fee })),
    dropped,
  };
}
