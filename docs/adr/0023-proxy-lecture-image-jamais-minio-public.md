# ADR-0023 — Lecture d'image via proxy applicatif, jamais de MinIO public

- **Statut** : accepté
- **Date** : 2026-07-23
- **Décideur** : Aymeric (MOE)

## Contexte et problème

BUG-011, découvert en recette staging (v1.2.0-rc.1, `TST-ENT-010`) : une image
uploadée avec succès dans MinIO ne s'affichait jamais côté client (texte
alternatif à la place). Cause : `GET /api/media/[imageId]` (KAN-16, ADR-0017)
résout une URL signée via `storage.getSignedUrl(key)` puis redirigeait
(`Response.redirect`, 302) le navigateur vers cette URL. Or l'endpoint MinIO
configuré (`env.S3_ENDPOINT`) est le nom de service Docker interne (`minio`,
réseau `storytide-staging_internal`) — jamais résolvable depuis un navigateur
hors de ce réseau. En dev, le bug ne se manifeste jamais : `S3_ENDPOINT=localhost`
et le port 9000 est mappé sur l'hôte, donc le navigateur (sur la même machine)
résout `localhost` sans problème — la staging multi-conteneurs est le premier
environnement à exposer réellement ce problème.

## Options envisagées

- **A — Exposer MinIO publiquement via Traefik** (nouveau sous-domaine ou route
  dédiée, endpoint public distinct de l'endpoint interne pour la présignature) :
  écartée. Casserait directement `TST-SEC-011` (déjà validé : PostgreSQL et
  MinIO jamais joignables depuis Internet, garde-fou explicite du projet) —
  résoudrait un bug fonctionnel en réintroduisant une régression de sécurité
  éliminatoire (C2.2.3). Ajoute aussi une nouvelle variable d'environnement
  (endpoint public) et une surface d'attaque (bucket accessible publiquement,
  même signé) sans bénéfice proportionné.
- **B — Proxy applicatif** (retenue) : `GET /api/media/[imageId]` continue de
  résoudre l'URL signée via l'endpoint interne (fonctionne, car le **serveur**
  tourne dans le même réseau Docker que MinIO), mais au lieu de rediriger le
  navigateur vers cette URL, le serveur fait lui-même le `fetch` et streame la
  réponse (`Response(upstream.body, ...)`) au client. Le navigateur ne parle
  jamais qu'à l'app (déjà publique via Traefik) — MinIO reste strictement
  interne, sans aucun changement d'infra, d'env, ni du port `Storage`.

## Décision

`src/app/api/media/[imageId]/route.ts` : après revalidation d'autorisation
(`getWorld`, inchangée), `storage.getSignedUrl(image.key)` reste utilisée telle
quelle, mais le résultat est fetché côté serveur puis streamé au client avec le
`Content-Type` persisté (`image.contentType`, jamais celui renvoyé par MinIO) —
plus de `Response.redirect`. Un échec de fetch (réseau ou statut non-2xx) logue
la cause réelle (`console.error`, jamais avalée, cf. CLAUDE.md) et renvoie `502`
générique.

Ce fetch serveur→MinIO n'est pas un vecteur SSRF (OWASP A10) : l'hôte cible
provient de la configuration serveur (`env.S3_ENDPOINT`), jamais d'une entrée
utilisateur — seuls la clé (`image.key`, UUID généré serveur) et la signature
(calculée serveur) varient. Documenté dans `docs/securite-owasp.md` (A01, A10).

La réponse porte `Cache-Control: private, max-age=31536000, immutable` :
`private` (jamais `public`) car la lecture reste soumise à autorisation
(`getWorld`, revalidée à chaque requête) — aucun cache partagé ne doit
répondre à la place du serveur ; `immutable`/`max-age` long car le contenu
d'un `imageId` ne change jamais (vérifié dans le code : `uploadImage` ne fait
qu'un `prisma.image.create`, aucun `update`/`upsert` sur `Image` n'existe dans
la base de code — un remplacement produit toujours un nouvel id). Sans ce
header, chaque affichage (y compris un simple défilement d'une page déjà vue)
referait proxyer l'intégralité du binaire ; avec, le coût du proxy disparaît
presque entièrement après la première lecture (cache navigateur).

## Conséquences

- **Positives** : aucun changement d'infra/déploiement/variable d'environnement ;
  `TST-SEC-011` reste intact (MinIO toujours strictement interne) ; le port
  `Storage` (`getSignedUrl`) n'est pas modifié, correctif localisé à une seule
  route ; le client ne voit jamais l'existence ni l'URL du stockage sous-jacent
  (surface d'information réduite, bénéfice secondaire).
- **Négatives / à surveiller** : le binaire de l'image transite désormais par le
  process Next.js (pas de redirection HTTP directe vers MinIO) — un coût
  CPU/mémoire supplémentaire par lecture, atténué en pratique par
  `Cache-Control: private, max-age=31536000, immutable` (le proxy ne joue
  réellement qu'à la première lecture par navigateur, le reste sert du cache
  local) ; à reconsidérer seulement si le volume de lectures devient malgré
  tout un vrai goulot d'étranglement, aucune donnée ne le suggère aujourd'hui.
  L'option A (exposition publique de MinIO) redeviendra pertinente lors de la
  migration prévue vers OVH Object Storage (endpoint public natif, contrairement
  à MinIO auto-hébergé) — à réévaluer par ADR à ce moment-là, pas anticipée ici.

## Compétence(s) servie(s)

C2.2.1 (architecture — port `Storage` inchangé, correctif localisé) ;
C2.2.3 (sécurité — préserve `TST-SEC-011`, A10 documenté comme non-SSRF) ;
C2.3.1 (recette — corrige BUG-011, bloquant identifié en recette staging) ;
C2.4.1 (traçabilité de la décision proxy-vs-MinIO-public).
