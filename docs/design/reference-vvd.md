# Référence design — vvd → pistes front Story Tide

> **Emplacement cible dans le repo :** `docs/design/reference-vvd.md`
> **Source :** audit en session réelle de `vvd.world` (monde de démo `la-cite-…`) via Claude-in-Chrome, le **2026-07-17**.
> **But :** capitaliser l'esthétique et l'architecture front de vvd (concurrent « le plus moderne ») pour cadrer la reprise visuelle du front de Story Tide, sans cloner. Sert de base au futur « prompt exhaustif » de refonte front et alimente **C2.2.1 / C2.2.3 / C2.4.1**.
>
> ⚠️ Les valeurs de tokens ci-dessous proviennent d'un relevé DOM live (variables CSS + styles calculés). Le monde audité utilise un **thème monochrome noir** (choix du créateur) : les couleurs de base de vvd ne sont donc pas prescriptives — c'est l'**architecture**, la **typo** et les **patterns** qui sont à reprendre. Pour des valeurs au pixel, ré-échantillonner via DevTools (voir annexe).

---

## 1. Direction esthétique

vvd assume un positionnement **« modern toolkit »** : minimaliste, aéré, éditorial, sombre. L'UI se fait discrète, le **contenu et l'artwork de l'utilisateur** portent la couleur. Système à base de **cartes** (fiches d'entités) façon wiki personnalisé priorisant lisibilité et esthétique.

Ce qu'on reprend pour Story Tide : le registre sombre/éditorial, la respiration, l'artwork mis en avant, la discrétion des liens.

---

## 2. Design tokens

### 2.1 Couleurs — décision Story Tide (palette Bloc 1 réutilisée)

On **ne reprend pas** les couleurs de vvd (monochrome de ce monde) : on réutilise la palette de `build.js` (Bloc 1) pour la continuité inter-blocs.

| Rôle | Token | Hex | Note |
|------|-------|-----|------|
| Fond de base | NAVY | `#122A3A` | le « bleu espace » |
| Surface / carte | INK | `#1C3A4B` | |
| Surface 2 | NAVY2 | `#15394A` | |
| **Accent « tide »** | **MINT** | **`#1FB39A`** | accent primaire (boutons, liens d'entités, focus) — lumineux sur navy |
| Accent sobre | TEAL | `#0E7C86` | hover, états secondaires |
| Accent rare | AMBER | `#D99000` | alertes uniquement |

Garde-fou : quand on posera shadcn/ui, **écraser son thème par défaut** avec ces tokens (sinon look générique « template shadcn »).

### 2.2 Typographie — décision Story Tide

- **Titres : Fraunces** (display serif chaleureuse, optical sizing → registre « écriture/récit »)
- **Corps / UI : Inter**
- **En réserve :** Spectral ou Lora (titres serif littéraires) ; Geist ou Space Grotesk+Inter (registre plus « tech »).
- Intégration via `next/font` ; contenu éditeur stylé par `@tailwindcss/typography` (`prose`) mappé sur Inter + titres Fraunces.

### 2.3 Tokens observés chez vvd (pour info)

- Système **paramétrable par monde** : le créateur choisit une couleur *primary* + une *accent*, vvd génère une **rampe de 18 tons** (`--color-primary-25` → `-950`).
- Fond = **artwork du monde** : `--bg-image` (média uploadé) + `--bg-overlay #00000080` (voile noir 50 %) + `--bg-blur 8px`. → pattern « artwork en fond flouté », à reprendre pour la landing / les mondes.
- Typo vvd : **Space Mono** (titres, monospace) + **Space Grotesk** (corps), 16px / interligne 1,5.
- Liens d'entités : **souligné pointillé** (`text-decoration: dotted`).
- Surlignages éditeur : **6 teintes pastel translucides** (jaune / vert / bleu / rose / violet / orange, ~30–35 % d'alpha).

---

## 3. Architecture de l'éditeur (le point le plus réutilisable)

Éditeur vvd = **Tiptap / ProseMirror** (classe DOM `tiptap ProseMirror card-editor-root prose prose-sm`) + `@tailwindcss/typography`. Notre choix Tiptap est donc aligné sur la référence.

Une **carte** (= fiche / entité) est un document Tiptap composé de **node views React custom** :

- nœud **`cardHeader`** — titre + image de couverture (contrôles « Changer le média / Recadrer / Passer en portrait ») + **propriétés** (voir §4) ;
- nœud **`contentBody`** — une **suite de blocs titrés** (chaque bloc a un champ « Titre du bloc », ex. « Histoire »).

Le `contentBody` se remplit via une **palette d'insertion de blocs** :

> Texte · Image · **Carte** (embed d'une autre entité) · Family Tree · Chronologie · **Bloc de statistiques 5e** · **Feuille de personnage 5e**

Les deux derniers sont des **blocs spécifiques JDR** (D&D 5e) — piste de différenciation pour la cible TTRPG (hors scope MVP).

**Liens d'entités = nœuds `mention` Tiptap** (`data-type="mention"`, `react-renderer node-mention`). → **C'est le chemin de rendu de notre auto-linking Aho-Corasick** : on rend chaque entité détectée comme un nœud mention (ou une décoration ProseMirror). Différence clé : vvd déclenche à la main (probablement `@`) ; Story Tide **détecte et pose automatiquement**.

Signaux d'accessibilité relevés : tokens sémantiques `text-foreground`, container queries Tailwind (`@[280px]:`), `sr-only` — cohérent avec l'approche shadcn/Radix retenue.

---

## 4. Modèle de données

### 4.1 Types d'entités

À la création d'une carte, on choisit un **Type** via un dialog cherchable. **24 types prédéfinis** relevés :

> Personnage · Lieu · Ville · Royaume · Objet · Arme · Armure · Artéfact · Potion · Sort · Divinité · Système magique · Prophétie · Événement · Histoire · Légende · Lore · Faune · Flore · Écologie · Point de repère · Note · Monde · *Treasure* (non traduit)

… **+ « Ajouter un nouveau type »** (extensible).

→ **Nuance notre objectif « pas de catégories rigides »** : la bonne UX n'est pas *aucune* catégorie, mais un **set de départ riche + extensible**. À reprendre.

### 4.2 Propriétés de carte

Une carte porte des **propriétés typées** (bouton « Ajouter une propriété »). Types de propriété relevés :

- **Texte** (libre)
- **Sélectionner** (liste / énum)
- **Relation typée vers une autre carte** (Personnage, Note, Monde… — tout type d'entité)

→ Les propriétés-relations sont les **arêtes explicites** du graphe. C'est ici que se joue l'articulation du différenciateur (voir §9).

---

## 5. Le graphe

- Rendu en **canvas 2D + fine couche SVG** en overlay (`webgl: false`) — nœuds/liens dessinés sur canvas, pas de nœuds en DOM.
- Choix perf : le canvas encaisse des centaines/milliers de nœuds là où le DOM/SVG pur (react-flow) sature au-delà de quelques centaines.

**Décision Story Tide** — proposition initiale react-flow (SVG) écartée avant
implémentation, remplacée par Cytoscape.js dès le MVP (canvas, comme vvd) : voir
`docs/adr/0012-graphe-cytoscape.md` (décision retenue) et
`docs/adr/0021-rendu-graphe-proposition-initiale-remplacee.md` (traçabilité de
l'écart avec la proposition ci-dessous).

Branche la parade « perf du liage à l'échelle ».

---

## 6. Navigation & UX

- **Rail d'icônes étroit** (gauche) : Mondes · Profil · avatars de mondes · Nouveau monde · Paramètres.
- **Sidebar de contenu** : Filtrer · Sélectionner · **Nouveau** (types de documents) · arborescence des cartes.
- **Taxonomie de documents** (menu « Nouveau ») : Document · Carte · **Carte géographique** · Canevas · Graphique · Arbre généalogique · Chronologie · Dossier.
- **Command palette** (`Ctrl+K`) — à poser dès le MVP (lib `cmdk`, incluse dans le composant `Command` de shadcn). Peut exposer les backlinks Aho-Corasick.
- **Éditeur multi-panneaux** : URL `?docs=id1,id2` → plusieurs cartes ouvertes côte à côte (P2).
- **Historique des révisions** (versioning des cartes).
- **« ? » bas-droite** : panneau **Aide → Tutoriels** (« Bases de l'éditeur », « Éditeur de maps », « Interface et éditeur ») + « Obtenir de l'aide » + « Raccourcis clavier » + « Quoi de neuf ». Un panneau raccourcis est lui-même une bonne feature accessibilité + onboarding.

---

## 7. Raccourcis clavier (relevé complet)

| Section | Action | Touches |
|---------|--------|---------|
| Général | Quitter le mode focus | `Esc` |
| Général | Annuler / Rétablir | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Général | **Ouvrir la palette de commandes** | `Ctrl+K` |
| Navigation | Afficher/masquer la sidebar | `Ctrl+B` |
| Navigation | Aller à l'onglet 1–5 | `1` `2` `3` `4` `5` |
| Éditeur | Gras / Italique / Souligné | `Ctrl+B` / `Ctrl+I` / `Ctrl+U` |
| Carte | Sélection / Zone / Texte | `V` / `Z` / `T` |
| Carte | Zoom + / − / Ajuster | `Ctrl++` / `Ctrl+-` / `Ctrl+0` |
| Carte | Désélectionner / Supprimer / Étiquettes | `Esc` / `Backspace` / `Ctrl+L` |
| Canevas | Sélection / Note texte / Média / Groupe | `V` / `T` / `M` / `G` |
| Chronologie | Déplacement / Sélection | `H` / `V` |
| Chronologie | Ajouter événement / Ajouter ère | `E` / `A` |
| Chronologie | Zoom + / − / Recentrer | `Ctrl++` / `Ctrl+-` / `Ctrl+0` |

Conventions à reprendre : `Ctrl+K` palette · `Ctrl+B` sidebar · `1`–`5` panneaux · outils mono-touche façon Figma sur les vues visuelles. **Pas de raccourci titres/listes → tout via le slash `/`** (extension *suggestion* Tiptap). Tiptap fournit gras/italique/souligné gratuitement ; le reste = un keymap à définir.

---

## 8. Décisions Story Tide issues de cet audit

| Décision | Statut |
|----------|--------|
| Accent **MINT `#1FB39A`** sur base **NAVY `#122A3A`** (palette Bloc 1) | ✅ validé |
| Couche composants **shadcn/ui (sur Radix)** + `@tailwindcss/typography` | ✅ validé |
| Typo **Fraunces (titres) + Inter (corps)** ; Spectral/Lora en réserve | ✅ validé |
| Architecture éditeur **`cardHeader` + `contentBody` (blocs titrés) + `mention` nodes** | 🔎 piste actée |
| Types d'entités : **set prédéfini riche + extensible** | 🔎 piste actée |
| Rendu graphe : **react-flow MVP → canvas 2D si scale** | 🟡 ADR-0010 (proposé) |
| Landing simple avec **artwork en fond** (image + voile + blur) | 🕓 post-MVP |
| Blocs JDR (statblock 5e, feuille de perso) | 🕓 P2/P3 |
| Thème paramétrable par monde | 🕓 P2 |
| Éditeur multi-panneaux | 🕓 P2 |

---

## 9. Différenciateur — articulation affinée

vvd offre une édition riche **mais toutes ses relations sont explicites et manuelles** (propriétés-relations + mentions `@`).

Story Tide combine **deux sources de relations** :

1. **explicites** — propriétés-relations et mentions posées à la main (comme vvd) ;
2. **implicites** — celles **auto-détectées dans la prose** par Aho-Corasick.

→ **Le graphe se peuple tout seul** au fil de l'écriture. C'est la formulation la plus nette de la valeur, et elle branche directement le risque principal (perf du liage à l'échelle) sur un bénéfice démontrable au Bloc 3.

---

## 10. Implications certification

- **C2.2.1** (élim., prototype/ergonomie) : design system navy/mint + shadcn/Radix + typo + patterns nav/éditeur = matière pour justifier les choix ergonomiques.
- **C2.2.3** (élim., accessibilité/évolutivité) : Radix = ARIA/clavier/focus natifs ; tokens sémantiques + panneau raccourcis clavier = leviers RGAA concrets ; artwork décoratif → `alt=""`.
- **C2.4.1** (doc au fil de l'eau) : ce document + ADR-0010.

---

## Annexe — Ré-échantillonner les tokens vvd via DevTools

Ouvrir l'**app/wiki** (pas seulement la landing marketing), puis `F12` :

1. **Pipette** — onglet *Styles* → cliquer un carré de couleur → icône pipette → cliquer sur la page → hex exact.
2. **Computed** — sélectionner un élément → onglet *Computed* → lire `background-color`, `color`, `border-color`, `font-family`, `font-size`, `line-height`, `border-radius`.
3. **Variables CSS (jackpot)** — sélectionner `:root` / `html` dans *Elements* → dans *Styles*, lire les custom properties (`--background`, `--foreground`, `--primary`, `--color-primary-*`…) : toute la carte de tokens d'un coup.

Check-list à capturer : fond de base · surface/carte · bordure · texte primaire · texte muted · accent/primary · accent hover · lien/surlignage · danger — puis les ranger dans `tailwind.config` → `theme.extend`.
