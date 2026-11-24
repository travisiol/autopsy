# DESIGN — Autopsy

> **v2 (24 nov.) `[F-137]`** : DA « The Lab » repensée façon **ASLAB** (Behance). Fond = shader WebGL « Fluted Glass · Waves » (21st.dev), recoloré ; cuves, flacons et pièces dessinés en SVG ; plus aucune image générée sur la page. Typo : Unbounded, Inter, JetBrains Mono. Palette : `#06100D` fond, `#79EC60` marque, `#A8E6A0` menthe (lignes), `#F4C226` SOL. Ce qui suit décrit la v1 (image clé), gardée pour l'historique.

> **DA validée (24 nov.) : THE LAB** `[F-134]` — le laboratoire de savant fou, sans personnage. Image clé : [design/key-art-the-lab.webp](design/key-art-the-lab.webp) (générée par l'utilisateur dans ChatGPT, style 4).
> Historique : The Morgue, Fiesta et Haunted (décors) rejetées `[F-133]` ; Pulp Lab, Anatomy Plates et Neon Frankenstein non retenues.

## L'idée visuelle
- Le site **est** le labo : chaque token mort du wallet flotte dans sa cuve verte avec son étiquette (cause de la mort), et la grande machine centrale distille le SOL récupéré, pièce par pièce, dans le flacon.
- Les cadavres sont des **peluches de memecoins génériques** (chien, grenouille, chat, hamster) aux yeux en X. C'est mignon, jamais gore.
- Les étiquettes d'orteil portent les vraies causes du moteur Vigil : BUNDLED, DEV DUMPED, SNIPED, RUG, STARVED.
- Rendu 3D semi-réaliste et brillant (verre, métal mouillé, lumière volumétrique), comme un décor de jeu vidéo haut de gamme.

## Palette (relevée au pixel sur l'image clé, puis adaptée au site)
| Rôle | Hex | D'où |
|---|---|---|
| Fond du labo | `#0A0D10` | sol et murs (relevé `#0C1012`) |
| Panneaux / métal | `#132621` · `#2D3436` | ombres vertes, acier |
| **Vert toxique (marque)** | `#79EC60` | le mot AUTOPSY |
| Vert profond (liquide) | `#38B453` | cuves |
| Vert pâle (étiquettes, texte doux) | `#B7D794` | étiquettes d'orteil |
| **Or SOL (argent récupéré uniquement)** | `#F4C226` | pièces et flacon |
| Violet électrique (câbles, accents) | `#7747BA` | câbles et néons |
| Teal verre (reflets, liens) | `#47A98F` | reflets des cuves |

Règle : le vert = le labo et la marque ; **l'or = uniquement le SOL que tu récupères** ; le violet = les détails (câbles, contours). Le rouge n'apparaît nulle part : ici, la mort est verte.

## Typo
- Titres et étiquettes : **Big Shoulders Display** (condensée, grasse, « plaque de labo »), comme le mot AUTOPSY de l'image.
- Texte : Inter.
- Chiffres (SOL, comptes, adresses) : JetBrains Mono.

## Moments animés
- **Entrée :** les néons s'allument un par un, le liquide des cuves bulle, l'aiguille de la jauge « SOL RECOVERED » tremble.
- **Autopsie :** chaque token du wallet tombe dans une cuve, son étiquette s'imprime (la cause de la mort), et le compteur de corps monte.
- **« Bury them » :** les tubes s'illuminent l'un après l'autre, les pièces d'or tombent dans le flacon au rythme des transactions confirmées (barre réelle `[F-123]` `[F-124]`), et l'aiguille monte jusqu'au SOL récupéré.
- **Sons :** bulles, néon qui grésille, clink des pièces dans le verre `[F-113]`, un bouton Music bien visible `[F-116]`.

## Comment ça marche (parcours)
1. **Landing** : « Your wallet died. Let's find out what killed it. » On colle n'importe quelle adresse (même celle d'un KOL), ou on connecte son wallet.
2. **L'autopsie tourne** (barre d'étapes réelle `[F-123]`) :
   - inventaire des tokens ;
   - tri vivant / mourant / mort ;
   - cause de mort de chaque token (moteur Vigil : bundle, dev qui a vendu, snipers, liquidité retirée, mort de faim) ;
   - pertes calculées sur l'historique (SOL entré − SOL sorti).
3. **Le rapport** :
   - nombre de « corps » et causes de mort ;
   - SOL perdu, pire blessure, meilleur trade ;
   - **type de trader** (Exit Liquidity, Paper Hands, Bag Holder, Sniper's Lunch…) ;
   - **« Recoverable : 0,43 SOL »**.
4. **« Bury them »** (wallet connecté) :
   - sélection des morts (tout par défaut) ;
   - aperçu « tu reçois X SOL, commission Y » ;
   - 1 à 3 signatures (une vingtaine de comptes par transaction) ;
   - le SOL revient directement dans le wallet.
5. **La carte à partager** : « Buried 214 rugs, recovered 0.43 SOL, Trader type: Exit Liquidity ».
6. **Cimetière public** :
   - plus gros cimetières ;
   - tokens qui ont tué le plus de wallets ;
   - devs « Wanted ».

## Directions écartées
The Morgue, Fiesta, Haunted (décors sans personnage) `[F-133]` ; planche : `design/da-board.html`.
