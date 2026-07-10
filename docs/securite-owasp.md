# Mesures de sécurité — Mapping OWASP Top 10 (2021) — C2.2.3 (ÉLIMINATOIRE)

> Remplir au fil de l'eau, une ligne par catégorie. Les 10 catégories sont le référentiel externe fixe.

> État au 2026-07-11 : lignes remplies = mesure réellement codée et vérifiée. Les
> autres portent une note explicite sur ce qui manque encore et à quelle étape ça
> arrive — pas de TODO muet.

| # | Catégorie OWASP 2021 | Risque pour Story Tide | Mesure mise en œuvre | Preuve (code/config/test) |
|---|---|---|---|---|
| A01 | Broken Access Control | Un utilisateur accède au monde/aux entités d'un autre | <!-- TODO : pas encore construit (aucun service World/Entity). Autorisation prévue en couche service (appartenance au monde vérifiée à chaque action), cf. CLAUDE.md §Architecture. --> | — |
| A02 | Cryptographic Failures | Mot de passe récupérable en clair (fuite DB) | Hash par Better Auth (scrypt, config par défaut) ; secrets (`BETTER_AUTH_SECRET`, credentials S3) uniquement via `.env`, jamais en dur ; TLS bout en bout : pas encore (pas de déploiement) | `src/lib/auth.ts` ; vérifié via `psql` : colonne `account.password` = `salt:hash`, jamais en clair |
| A03 | Injection | Injection SQL / payload non validé | Prisma (requêtes paramétrées, aucune concaténation SQL) ; Zod à chaque frontière (env, Server Actions) | `src/env.ts`, `src/lib/auth-schemas.ts`, `src/actions/auth.ts` |
| A04 | Insecure Design | Abus (brute force, spam d'inscriptions) | Rate limiting par défaut de Better Auth (config fine pas encore ajustée) ; quotas freemium : <!-- TODO, pas construits --> | `src/lib/auth.ts` |
| A05 | Security Misconfiguration | Ports/services exposés, headers manquants | <!-- TODO : pas encore construit (pas de middleware CSP/headers, pas de déploiement Traefik). Prévu à l'étape déploiement. --> | — |
| A06 | Vulnerable and Outdated Components | Dépendance vulnérable connue | Versions vérifiées à l'installation (Better Auth, pg-boss, Prisma — réflexe systématique cette session, cf. ADR) ; Dependabot/`npm audit` en CI : <!-- TODO, pas encore de CI --> | `package.json` (versions figées) |
| A07 | Identification and Authentication Failures | Énumération de comptes, session non révocable | Sessions en base (révocables), cookies `HttpOnly`/`SameSite=Lax` ; message générique unique en cas d'échec de connexion (ne révèle jamais si l'e-mail existe) | `src/actions/auth.ts` (`loginAction`) ; vérifié via curl : `401 INVALID_EMAIL_OR_PASSWORD` → mappé en message générique côté action |
| A08 | Software and Data Integrity Failures | Image/dépendance compromise à l'insu | CI = seule source des images, provenance ghcr : <!-- TODO, pas encore de CI/CD --> | — |
| A09 | Security Logging and Monitoring Failures | Incident non détecté (pas de trace) | Logs structurés (pino), traçage des échecs authz : <!-- TODO, pas encore mis en place --> | — |
| A10 | Server-Side Request Forgery (SSRF) | Upload détourné (fake MIME, URL fournie par l'utilisateur) | Aucun fetch d'URL utilisateur au MVP (pas de feature concernée) ; buckets MinIO **privés par défaut** (créés ainsi dès `docker-compose.dev.yml`), accès uniquement via URLs signées à expiration | `src/lib/storage/s3-adapter.ts` (`getSignedUrl`), `docker-compose.dev.yml` (`minio-setup` : `mc anonymous set none`) ; validation MIME/magic-bytes : <!-- TODO, arrivera avec le service d'upload --> |
