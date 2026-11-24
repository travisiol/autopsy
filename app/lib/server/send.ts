import "server-only";
import { SystemInstruction, SystemProgram, Transaction } from "@solana/web3.js";
import { rpc, TOKEN, TOKEN22, TREASURY } from "./config";

/**
 * Diffusion des transactions signées par le joueur.
 * La page renvoie celles qui ne sont pas encore confirmées toutes les 2 s : chaque appel les rediffuse
 * et dit où elles en sont. On ne relaie que des transactions d'Autopsy (burn, close, 5 % à la trésorerie).
 */

const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toB58(bytes: Uint8Array) {
  let n = 0n; for (const x of bytes) n = n * 256n + BigInt(x);
  let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const x of bytes) { if (x === 0) s = "1" + s; else break; }
  return s;
}

const TOKEN_IX = new Set([9, 15]); // closeAccount, burnChecked

export type TxState = { sig: string; state: "pending" | "confirmed" | "failed" | "expired" };

// Une transaction d'Autopsy : au moins une fermeture de compte, et aucun transfert de SOL ailleurs qu'à la trésorerie.
// (Certains wallets ajoutent leurs propres instructions de protection : on les laisse passer.)
function check(tx: Transaction) {
  const payer = tx.feePayer?.toBase58();
  if (!payer || !tx.signatures.length || !tx.signatures[0].signature) throw new Error("Unsigned transaction");
  let closes = 0;
  for (const ix of tx.instructions) {
    const p = ix.programId;
    if (p.equals(TOKEN) || p.equals(TOKEN22)) { if (!TOKEN_IX.has(ix.data[0])) throw new Error("Unexpected instruction"); if (ix.data[0] === 9) closes++; continue; }
    if (p.equals(SystemProgram.programId)) {
      const t = SystemInstruction.decodeTransfer(ix);
      if (t.toPubkey.toBase58() !== TREASURY) throw new Error("Unexpected transfer");
    }
  }
  if (!closes) throw new Error("Not an Autopsy transaction");
}

export async function sendAll(raws: string[], lastValidBlockHeight: number): Promise<TxState[]> {
  const txs = raws.map((r) => Transaction.from(Buffer.from(r, "base64")));
  txs.forEach(check);
  const c = rpc();
  const b58 = txs.map((t) => toB58(t.signatures[0].signature!));

  const [st, height] = await Promise.all([c.getSignatureStatuses(b58), c.getBlockHeight("confirmed")]);
  const out: TxState[] = [];
  await Promise.all(
    txs.map(async (t, i) => {
      const s = st.value[i];
      if (s?.err) return (out[i] = { sig: b58[i], state: "failed" });
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return (out[i] = { sig: b58[i], state: "confirmed" });
      if (height > lastValidBlockHeight) return (out[i] = { sig: b58[i], state: "expired" });
      await c.sendRawTransaction(t.serialize(), { skipPreflight: true, maxRetries: 0 }).catch(() => null);
      out[i] = { sig: b58[i], state: "pending" };
    }),
  );
  return out;
}
