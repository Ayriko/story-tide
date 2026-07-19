# ADR-0017 — Upload d'images : référence stable + sniffing maison, pas de librairie tierce

- **Statut** : accepté
- **Date** : 2026-07-19/20
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-16 : upload d'images depuis l'éditeur Tiptap, stockées dans MinIO via le
port `Storage` (déjà existant depuis KAN-11 — adaptateur S3 réel, fake mémoire
pour les tests, aucune modification nécessaire côté port). Deux contraintes
techniques structurent la conception :
1. `isSafeHttpUrl` (`tiptap-content.ts`, déjà en place, audité OWASP A03)
   exige que `image.src` soit une URL `http(s)` **absolue** ≤ 2048 caractères —
   une URL MinIO présignée est longue (signature, expiration en query string)
   et **expire**, donc ne peut pas être persistée telle quelle dans le
   contenu Tiptap sauvegardé.
2. La spec exige une validation MIME **réelle** (magic bytes), pas seulement
   le `Content-Type` déclaré par le navigateur (falsifiable) — OWASP A10.

## Options envisagées

**Référence persistée dans `image.src` :**
- **A — Persister l'URL présignée directement** : viole la contrainte 2048
  caractères en pratique et casse dès l'expiration (3600 s par défaut du
  port) — écartée.
- **B — Référence stable (`/api/media/<imageId>`), résolue en URL signée
  fraîche à CHAQUE lecture** par un Route Handler dédié — retenue. Bénéfice
  secondaire : l'autorisation (`getWorld`) est revalidée à chaque affichage
  d'image, pas seulement à l'upload.

**Validation MIME par magic bytes :**
- **A — Librairie tierce** (type `file-type`) : fiable, maintenue, mais
  nouvelle dépendance pour 4 formats seulement (PNG/JPEG/GIF/WebP) — écartée,
  disproportionné.
- **B — Sniffing maison** (`src/lib/image-validation.ts`, zéro dépendance) :
  quelques comparaisons de préfixes d'octets suffisent pour ces 4 formats —
  retenue, même esprit "zéro dépendance" que `src/lib/linker`.

**Transport de l'upload (navigateur → MinIO) :**
- **A — URL présignée PUT, upload direct navigateur → MinIO** : demanderait
  d'étendre le port `Storage` (actuellement `getSignedUrl` ne présigne qu'un
  GET) ; surtout, empêche une validation magic-bytes fiable côté serveur
  AVANT que l'objet n'atterrisse dans le bucket (il faudrait relire l'objet
  après coup pour le valider, ou faire confiance au client) — écartée.
- **B — Upload tamponné via Server Action** (`FormData` contenant un `File`,
  lu en `Buffer` côté serveur, `storage.upload()` existant sans modification) —
  retenue : le serveur voit les octets réels avant tout envoi vers MinIO, la
  validation magic-bytes est donc fiable par construction. Suffisant à
  l'échelle de ce projet (pas de trafic haut volume attendu).

## Décision

Modèle `Image` (métadonnées uniquement : `worldId`, `key`, `contentType`,
`size` — le binaire vit dans MinIO). `uploadImage` (`image-service.ts`) :
cascade d'autorisation `getWorld`, borne de taille (5 Mo, arbitré avec
Aymeric), sniffing magic-bytes maison (`sniffImageMime`), `storage.upload`
existant, puis persistance des métadonnées et renvoi de
`${BETTER_AUTH_URL}/api/media/<imageId>` comme `src`. Lecture via
`GET /api/media/[imageId]` : `requireSession` → `prisma.image.findUnique` →
`getWorld` (même garde-fou anti-fuite-d'existence que `getEntity`) →
`storage.getSignedUrl` → redirection 302.

**Purge RGPD** : `deleteWorld` (`world-service.ts`) supprime désormais les
objets MinIO associés au monde avant de supprimer le monde en base
(`storage.delete` par image). Choix **best-effort** (Aymeric) : un échec de
purge est loggué (`console.error`, jamais avalé) mais ne bloque pas la
suppression du monde — un objet MinIO orphelin sans référence DB est une
donnée inerte, rattrapable par un futur job de ménage, plutôt qu'un incident
MinIO transitoire qui empêcherait un utilisateur de fermer/purger son monde.

## Conséquences

- **Positives** : `image.src` reste toujours valide et court, quelle que soit
  l'expiration MinIO ; validation MIME fiable par construction (octets vus
  avant tout envoi) ; zéro nouvelle dépendance ; zéro modification du port
  `Storage` existant ; l'autorisation est revérifiée à chaque affichage
  d'image, pas seulement à l'upload.
- **Négatives / à surveiller** : l'upload transite par le serveur Next.js
  (pas de upload direct navigateur→MinIO) — acceptable à l'échelle actuelle,
  à reconsidérer seulement si le volume/la taille des images devient un vrai
  goulot d'étranglement (pas le cas aujourd'hui, aucune donnée ne le suggère).
  Les images uploadées puis jamais insérées dans un contenu sauvegardé, ou
  retirées après coup d'un contenu, ne sont pas nettoyées automatiquement —
  limité en pratique par le déclenchement de l'upload au clic "Insérer"
  (pas au choix du fichier), mais pas éliminé ; backlog si le volume devient
  un problème réel.

## Compétence(s) servie(s)

C2.2.1 (architecture — réutilisation du port Storage sans le modifier,
séparation métadonnées/binaire) ; C2.2.3 (sécurité — OWASP A10 magic-bytes,
A01 revalidation à la lecture ; accessibilité — alt obligatoire, lazy-load) ;
C2.4.1 (traçabilité de la décision référence-stable-vs-URL-présignée).
