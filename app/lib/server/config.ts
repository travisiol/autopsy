import "server-only";
import { Connection, PublicKey } from "@solana/web3.js";

/** Réglages d'Autopsy (variables d'environnement : .env.local en local, Vercel en ligne). */
export const RPC_URL = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
export const JUPITER_API_KEY = process.env.JUPITER_API_KEY?.trim() || "";

/** Wallet qui reçoit les 5 % (trésorerie, la même que Shiny `[F-143]`). Jamais affichée sur le site `[F-073]`. */
export const TREASURY = process.env.TREASURY_WALLET?.trim() || "";

/** 5 % du SOL récupéré, pareil pour tout le monde `[F-142]`. */
export const FEE_BPS = 500;

/** En dessous de cette valeur (en $), un token est considéré comme mort et peut être enterré. */
export const DEAD_USD = 0.1;

export const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN22 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const WSOL = "So11111111111111111111111111111111111111112";

let conn: Connection | null = null;
export const rpc = () => (conn ??= new Connection(RPC_URL, "confirmed"));
