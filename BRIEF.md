# BRIEF — Autopsy (nom de travail ; domaine visé : autopsy.fun, libre le 24 nov.)

## En une phrase
> Tu connectes ton wallet : Autopsy fait l'autopsie de ta vie de trader (rugs mangés, causes de mort, pire trade, type de trader), puis brûle tes tokens morts pour te rendre le SOL qu'ils bloquent.

## Idée d'origine
ID-014 dans [idees/IDEES.md](../../idees/IDEES.md) — note : **8,1/10** — choisie le 24 nov. `[F-131]`

## Le problème
- Chaque token acheté ouvre un compte qui bloque environ 0,002 SOL. Un trader actif a des dizaines, voire des centaines de tokens morts : 0,2 à 1 SOL qui dorment.
- Personne ne te dit **ce qui a tué** tes tokens (bundle, dev qui vend, snipers) ni ce que ça t'a coûté.

## La cible
Tous les traders memecoin Solana : chacun en profite dès la première minute, seul `[F-130]`.

## Fonctionnalités clés (MVP)
1. **Scan du wallet** : tokens morts (valeur ~0, plus de volume), poussière, comptes vides.
2. **Autopsie** : cause de mort de chaque token (moteur Vigil : bundle, dev qui a vendu, snipers, mort de faim), argent perdu, pire et meilleur coup, « type de trader ».
3. **« Bury them »** : brûle les tokens morts et ferme leurs comptes en une ou quelques signatures, puis le SOL revient au joueur. Petite commission prise sur le SOL récupéré.
4. **Carte à partager** : « J'ai enterré 214 rugs et récupéré 0,43 SOL », avec le type de trader.
5. **Cimetière public** : classement des plus gros cimetières, et des tokens qui ont tué le plus de wallets.

## Ce qui le rend différent
- Les outils de récupération de SOL existent (type Sol Incinerator), mais ils sont froids et génériques.
- Autopsy raconte **l'histoire** de tes pertes (causes de mort prouvées par le moteur Vigil), avec une vraie DA et une carte virale.
- Commission plus basse que les concurrents, 0 % pour les holders au-dessus d'un seuil `[F-086]`.

## Pages
- Landing (le concept + une autopsie d'exemple sur un vrai wallet)
- App : connexion → autopsie → « Bury them » → carte
- Cimetière public (classements)

## Tech Solana utilisée
- Connexion wallet (Wallet Standard, comme Shiny).
- Helius (comptes de tokens, historique).
- Moteur anti-rug de Vigil (causes de mort).
- Instructions SPL Token `burn` + `closeAccount` (transactions préparées par le serveur, signées par le joueur ; le SOL revient directement dans son wallet).
- La commission est un transfert dans la même transaction.
- Next.js sur Vercel (`app/`, la page vient de `site/` au build). Pas de base de données : le serveur ne garde rien.
- Construit le 24 nov. : `/api/autopsy` (comptes SPL + Token-2022, fiches Jupiter Tokens v2, noms Helius DAS), `/api/bury` (transactions simulées avant signature), `/api/send` (rediffusion jusqu'à confirmation). Classement : morts (jamais migré, saigné, rug, mort-né), comptes vides, **miettes** de tokens vivants (liquidité ≥ 50 k$ : à part, non cochées), vivants ≥ 0,10 $ jamais touchés ; NFT, wSOL, comptes gelés écartés.

## Monétisation
- **Commission : 5 % fixes pour tout le monde**, sur le SOL récupéré uniquement (décidé le 24 nov. `[F-142]`). Pas d'exemption holders.
- **Wallet qui reçoit les 5 % : la trésorerie de Shiny** `AQKqLA27QFCpeysa5kyrKgb7BiQCyFX12hGzi3h7UCwp` (décidé le 24 nov. `[F-143]`). Jamais affichée sur le site `[F-073]` ; elle n'apparaît que dans la transaction que le joueur signe. Le serveur n'a besoin d'aucune clé : la commission est un transfert dans la transaction du joueur.
- Parrainage : une part de la commission pour celui qui amène un ami.
- Une partie des revenus rachète le token.

## Points ouverts
- Nom définitif et domaine : **autopsy.fun** (libre), alternatives libres : coroner.fun, graveyard.fun, tombstone.fun, postmortem.fun. Vérifier le prix chez le registrar (les `.fun` courts peuvent être « premium »).
- Nouvelle DA (pas celle de Shiny ni de Vigil).
