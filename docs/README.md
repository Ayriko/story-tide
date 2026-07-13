# Documentation — Story Tide (Bloc 2, RNCP39583)

> Docs-as-code : chaque brique est rédigée **au fil du dev**, au moment où l'action correspondante est réalisée.
> Le **dossier écrit de 30 pages** (`dossier/plan.md`) en est l'assemblage éditorialisé, structuré dans l'ordre de la grille.
> ⚠️ Jamais de secret réel en clair ici (URLs de prod OK, tokens/mots de passe non).

## Cartographie brique → compétence → livrable imposé du dossier

| Brique (`/docs/…`) | Compétence | Livrable dossier (règlement spécial) | Éliminatoire | État (2026-07-14) |
|---|---|---|---|---|
| `architecture.md` | C2.2.1 | Architecture maintenable · prototype · framework/paradigmes | **OUI** | 🟡 démarré (auth + mondes + entités) |
| `tests-unitaires.md` | C2.2.2 | Jeu de tests unitaires couvrant une fonctionnalité | **OUI** | 🟡 démarré (env, schémas, fakes, LoginForm, world-service, entity-service) |
| `securite-owasp.md` | C2.2.3 | Mesures de sécurité (OWASP Top 10) | **OUI** | 🟡 4/10 catégories (A01, A02, A03, A07) |
| `accessibilite-rgaa.md` | C2.2.3 | Actions d'accessibilité (RGAA) | **OUI** | 🟡 démarré (login/register + mondes + entités), audit outillé pas fait |
| `cahier-recettes.md` | C2.3.1 | Cahier de recettes | **OUI** | 🟡 19 scénarios (AUT + SEC + MND + ENT) |
| `cd.md` | C2.1.1 | Protocole de déploiement continu | non | ⬜ pas commencé |
| `qualite-performance.md` | C2.1.1 | Critères de qualité et de performance | non | 🟡 qualité statique bloquante en CI, perf = cibles |
| `ci.md` | C2.1.2 | Protocole d'intégration continue | non | ✅ workflow GitHub Actions en place |
| `plan-correction-bogues.md` | C2.3.2 | Plan de correction des bogues | non | 🟡 SLA + BUG-001 |
| `manuels/deploiement.md` | C2.4.1 | Manuel de déploiement | non | ⬜ pas commencé |
| `manuels/utilisation.md` | C2.4.1 | Manuel d'utilisation | non | ⬜ pas commencé |
| `manuels/mise-a-jour.md` | C2.4.1 | Manuel de mise à jour | non | ⬜ pas commencé |
| `adr/` | C2.4.1 | Justification des choix (technos, langages) | non | ✅ 8 ADR rédigés |
| `../CHANGELOG.md` (racine) | C2.2.4 | Historique des versions | non | ✅ créé (`[Unreleased]`) |
| `dossier/plan.md` | — | Plan d'assemblage des 30 p. | — | ✅ ossature posée |
