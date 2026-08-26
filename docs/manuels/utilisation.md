# Manuel d'utilisation — C2.4.1

> Complété le 2026-07-24 pour le dépôt Bloc 2. Décrit l'usage de la version en
> production (v1.2.1, `storytide.fr`). Voir aussi `docs/manuels/deploiement.md`
> (exploitation) et `docs/manuels/mise-a-jour.md` (montée de version).

## 1. Prise en main

### 1.1 Créer un compte

1. Aller sur `/register` (`storytide.fr`).
2. Renseigner nom, e-mail et mot de passe (≥ 8 caractères).
3. Par défaut, un **monde d'exemple « Atheraus »** (25 entrées peuplées,
   `origin: INTRO`) est cloné pour le compte afin de découvrir immédiatement le
   produit. Pour ne pas le créer, cocher **« Ne pas créer le monde d'exemple
   "Atheraus" »** avant de soumettre (comportement *opt-out*).
4. La soumission ouvre une session (cookie `HttpOnly`, `SameSite=Lax`) et
   redirige vers `/worlds`.

La connexion ultérieure se fait sur `/login`. En cas d'échec, un message
générique unique s'affiche (« E-mail ou mot de passe incorrect. ») — aucune
information ne permet de deviner si l'e-mail existe. La déconnexion se fait via
le bouton **« Se déconnecter »** du header.

### 1.1 bis Mot de passe oublié

1. Sur `/login`, cliquer **« Mot de passe oublié ? »** sous le champ mot de passe.
2. Saisir l'adresse e-mail du compte et valider. Le message affiché est le même
   que l'adresse ait un compte ou non : c'est volontaire — cela évite que ce
   formulaire serve à découvrir quelles adresses sont inscrites.
3. Ouvrir le message reçu (expéditeur `contact@storytide.fr`) et cliquer sur
   **« Choisir un nouveau mot de passe »**. Le lien est **valable une heure** et
   ne fonctionne **qu'une seule fois**. Si rien n'arrive, penser aux courriers
   indésirables.
4. Saisir le nouveau mot de passe (≥ 8 caractères) et valider.
5. La page de connexion se rouvre avec la confirmation « Mot de passe modifié. » :
   se connecter avec le nouveau mot de passe. La session n'est **pas** ouverte
   automatiquement — un lien reçu par courrier ne suffit jamais à ouvrir une
   session.

Si le lien a expiré ou a déjà servi, la page l'indique et propose
**« Demander un nouveau lien »**. L'ancien mot de passe reste valable tant qu'un
nouveau n'a pas été enregistré.

### 1.2 Créer un monde

Sur `/worlds`, saisir un nom dans **« Nouveau monde »** puis valider. Le *slug*
d'URL est dérivé automatiquement du nom (minuscules, sans accents, tirets) —
jamais saisi à la main. L'offre gratuite autorise **3 mondes** (le monde
d'exemple « Atheraus » n'est pas décompté). Le renommage et la suppression
(confirmation en deux étapes) se font depuis la page du monde.

### 1.3 Ajouter des fiches (entités)

Depuis un monde, **« Nouvelle entrée »** ouvre le dialogue de création :

- **Nom** de l'entité.
- **Type** : sélecteur cherchable regroupant 26 types en 8 familles
  (personnage, lieu, faction, objet, événement…). Le type est une donnée, pas
  un schéma figé.
- **Alias** (un par ligne) : surnoms, titres, formes courtes ou accentuées.
  **Ce sont eux qui alimentent la détection automatique de liens** — plus une
  entité a d'alias plausibles, plus elle est détectée dans la prose des autres
  fiches.

L'offre gratuite autorise **50 entrées par monde**.

## 2. Fonctionnalités clés

### 2.1 L'éditeur riche

Chaque fiche dispose d'un éditeur (Tiptap) avec une barre d'outils : **Titre**,
**Sous-titre**, **Gras**, **Italique**, **Citation**, **Liste à puces**,
**Liste numérotée**, **Lien** et **Image**. Le contenu est **sauvegardé
automatiquement** (sauvegarde *debouncée*) ; un indicateur annonce l'état
(« Enregistrement… » / « Enregistré. »). Les liens sont restreints aux
protocoles `http`/`https` ; l'insertion d'une image exige une **légende**
(texte alternatif obligatoire, accessibilité), et accepte l'import de fichier
(PNG/JPEG/GIF/WebP, ≤ 5 Mo) ou une URL. Une image insérée se redimensionne à la
poignée (souris) ou aux flèches gauche/droite une fois sélectionnée (clavier).

### 2.2 La liaison automatique (cœur du produit)

Il n'y a **rien à faire pour créer un lien** : dès qu'une fiche cite en toutes
lettres le nom **ou un alias** d'une autre entité du même monde, Story Tide
détecte la mention (moteur Aho-Corasick, côté serveur, après la sauvegarde) et
crée le lien. La mention est **surlignée** dans l'éditeur ; un `Ctrl`/`Cmd`+clic
dessus navigue vers la fiche liée. Le résultat apparaît sous l'éditeur :

- **Renvois** : les entités que cette fiche mentionne (liens sortants).
- **Échos** : les fiches qui mentionnent celle-ci (rétroliens / backlinks).

Le garde-fou **« Ignorer ce lien »** (depuis « Renvois ») empêche un lien
automatique détecté de se recréer si on ne le souhaite pas. Il est aussi
possible de poser une **mention manuelle** en tapant `@` puis en choisissant
une entité dans la liste de suggestions (navigable au clavier) — une mention
manuelle n'est jamais écrasée par une détection automatique ultérieure.

### 2.3 La Constellation (graphe de relations)

La page **Constellation** (`/worlds/[slug]/graph`) affiche l'univers comme un
graphe : chaque entité est un nœud (coloré par famille de type), chaque lien
une arête. Cliquer un nœud ouvre la fiche correspondante. Le panneau
**« Filtres »** permet de masquer/afficher les nœuds par type. Pour une
navigation sans souris, le disclosure **« Observer les fils »** révèle une
liste de liens accessible au clavier et aux lecteurs d'écran, équivalente au
graphe.

### 2.4 La recherche

Le champ **« Rechercher une entrée »** filtre en direct les fiches d'un monde
par nom **ou par alias**, insensible à la casse et aux accents. La recherche
reste toujours limitée au monde courant.

## 3. Accessibilité

L'application est utilisable **entièrement au clavier** (formulaires, éditeur,
suppression en deux étapes, filtres et liste de la Constellation). Le
référentiel suivi est le **RGAA** (voir `docs/accessibilite-rgaa.md`).

## 4. Contact et mentions légales

Un pied de page est présent sur `/login`, `/register`, `/worlds` et les pages
d'un monde (visible en bas de l'écran, atteint en faisant défiler le contenu
dans l'application) ainsi que sur la page **« Mentions légales »**. Il porte
trois liens :

- **« Mentions légales »** → `/mentions-legales` : éditeur du site, directeur
  de la publication, hébergeur, nature du service, et un volet « Données
  personnelles » (données collectées, finalité, droits, cookies).
- **« Contact »** → `contact@storytide.fr`, le **canal officiel des retours
  bêta** : questions, signalements de bogues, et exercice des droits
  d'accès/rectification/suppression décrits sur la page légale (demande
  traitée sous 30 jours).
- **« Statut du service »** → `status.storytide.fr`, la sonde externe (voir
  `docs/supervision.md`), ouvert dans un nouvel onglet.

## 5. Compte de démonstration (kit jury)

Il n'y a **pas de compte partagé** : chaque évaluateur s'inscrit **en
autonomie** sur `storytide.fr` et reçoit automatiquement le monde
d'introduction **« Atheraus »** (25 entrées, ~73 liens automatiques), conçu
pour démontrer la liaison automatique (homonymes, sous-chaînes, frontières de
mots, diacritiques, mentions manuelles, article à forte densité de mentions
pour le surlignage). L'environnement de préproduction est accessible sur
`staging.storytide.fr`, l'état du service sur `status.storytide.fr`. Le
lancement en local est documenté dans le `README` (trois commandes,
`.env.example` fourni).
