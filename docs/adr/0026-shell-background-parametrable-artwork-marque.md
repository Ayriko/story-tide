# ADR-0026 — Contrat de `ShellBackground` étendu par variables CSS pour l'artwork de marque

- **Statut** : accepté
- **Date** : 2026-08-26
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-xx. L'artiste a livré l'artwork de la page de connexion (composition 16:9 :
lettrage constellations en haut-gauche, personnage centre-gauche, tiers droit
volontairement dégagé pour le panneau de formulaire). `ShellBackground`
(partagé par `(auth)`, `(app)` et `mentions-legales` depuis KAN-36) expose déjà
`--bg-image` pour accueillir un artwork, mais son voile de protection
(`bg-black/45 backdrop-blur-md`, codé en dur) est dimensionné pour un artwork
**quelconque** — un monde uploadé par un utilisateur en `(app)`, dont rien ne
garantit ni le cadrage ni la luminosité. Appliqué tel quel à une composition
commandée exprès, ce voile fixe s'est révélé contre-productif : le flou
uniforme couvrait tout l'écran (pas seulement sous le panneau), et un cadrage
`bg-center` rognait le lettrage "STORY TIDE" sur toute fenêtre non
exactement 16:9. Mesuré sur le rendu réel (protocole texte-transparent,
`docs/accessibilite-rgaa.md`), le voile ne protégeait en réalité qu'une seule
zone hors carte (le pied de page) et un cas marginal du panneau — partout
ailleurs la carte et le pied de page absorbaient déjà le contraste par leurs
propres calques.

## Options envisagées

- **A — Ne rien changer** (écartée) : le voile fixe reste sûr par défaut,
  mais assombrit et floute l'artwork commandé dans son ensemble, à l'encontre
  de ce pour quoi il a été payé — le tiers droit dégagé perd son intérêt si
  le reste de l'image est méconnaissable.
- **B — Dupliquer `ShellBackground` pour `(auth)`** (écartée) : un composant
  dédié à l'artwork de marque, hors du composant partagé. Réintroduit
  exactement la divergence que KAN-36 avait supprimée (deux implémentations
  du même fond plein écran à maintenir en synchronisation) pour un besoin qui
  se résume à trois valeurs différentes.
- **C — Étendre le contrat de `ShellBackground` par variables CSS**
  (retenue) : `--shell-scrim` (couleur/opacité du voile), `--shell-scrim-blur`
  et `--shell-bg-position` viennent compléter `--bg-image` (déjà existante,
  KAN-36) comme points d'extension. Valeurs par défaut dans `:root` =
  équivalent exact de l'ancien comportement codé en dur ; `(auth)` seul les
  surcharge via une classe `.auth-artwork` posée sur la racine du layout.
  `(app)` et `mentions-legales` héritent des défauts sans qu'un seul octet de
  leur rendu ne change.

## Décision

`ShellBackground` (`src/app/shell-background.tsx`) consomme quatre variables
CSS, toutes déclarées avec leur valeur historique dans `:root`
(`src/app/globals.css`) : `--bg-image` (repli `--shell-bg-fallback`),
`--shell-scrim`, `--shell-scrim-blur`, `--shell-bg-position`. `.auth-artwork`
(posée sur la racine de `(auth)/layout.tsx`) surcharge les quatre pour
l'artwork de marque, avec les valeurs retenues après mesure sur le rendu réel
(1920×1080 et 2880×1620, DPR 1 et 2) :

- `--shell-scrim: transparent` — le voile plat est retiré (retour Aymeric :
  il assombrissait l'artwork au-delà de ce qui était nécessaire). Compensé
  localement là où c'était réellement requis : `bg-black/80` sur le pied de
  page (`(auth)/layout.tsx`, seul élément hors carte donc sans protection
  propre) et `bg-card/45` → `/55` sur la carte (`auth-card.tsx`).
- `--shell-scrim-blur: 0px` — le flou uniforme est retiré ; la « vitre
  dépolie » reste portée par `backdrop-blur-xl` de la carte elle-même, pas
  par le fond entier.
- `--shell-bg-position: left 8%` — ancrage haut-gauche (protège le lettrage
  du rognage `bg-cover` sur fenêtre non-16:9) avec un léger décalage vertical
  pour ne pas laisser de marge de ciel vide au-dessus du titre.

## Conséquences

- **Positives** : `(app)` et `mentions-legales` intégralement préservés —
  vérifié en comparant le CSS compilé avant/après (aucune des quatre
  variables n'apparaît en dehors de `:root` et `.auth-artwork`). Le patron
  est réutilisable tel quel pour un futur artwork par monde (KAN-36 P-suivant)
  sans toucher de nouveau à `ShellBackground`.
- **Négatives / à surveiller** : un écart de contraste connu et accepté
  subsiste — le sous-titre du panneau mesure 3,55:1 (sous le seuil RGAA
  4,5:1) uniquement sur la variante 2880 (affichages 2x), une zone claire de
  cette variante précise traversant ce coin de carte. Ni `bg-card/55` ni un
  résidu de voile n'ont suffi à le corriger sans re-assombrir l'ensemble ;
  arbitrage délibéré en faveur de la fidélité visuelle. À rouvrir si l'audit
  RGAA formel l'exige (candidat `plan-correction-bogues.md`). Les valeurs
  locales (`/80`, `/55`) sont calées sur CET artwork précis — un
  remplacement d'artwork exigerait de re-mesurer.

## Compétence(s) servie(s)

C2.2.1 (architecture — extension propre du contrat d'un composant partagé,
zéro divergence pour les écrans non concernés) ; C2.2.3 (sécurité et
accessibilité — mesure de contraste sur rendu réel, écart documenté plutôt
que masqué) ; C2.4.1 (traçabilité de la décision).
