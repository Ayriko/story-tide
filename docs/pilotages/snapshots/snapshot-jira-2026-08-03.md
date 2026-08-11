# Snapshot de pilotage — Story Tide

**Date du relevé :** 3 août 2026
**Source :** Jira Cloud — `story-tide.atlassian.net`, projet **KAN** (« storytide-team », Kanban team-managed)
**Requête :** `project = KAN` — 40 tickets récupérés (6 epics + 32 stories + 2 bugs), lecture seule
**Référentiel de chiffrage :** 168 SP ≈ 84 j/h (1 SP ≈ 0,5 j/h)
**Certification :** RNCP39583 — Bloc 3, compétence C3.2.1 (indicateurs de délais, coûts, avancement)

---

## 1. Répartition par statut

Le board ne comporte que deux statuts réellement utilisés à ce jour : **Backlog** et **Terminé**. Les colonnes « À faire », « En cours » et « Revue » ne contiennent aucun ticket au moment du relevé.

| Statut | Tickets | Story points |
|---|---:|---:|
| Terminé | 25 | 116 |
| Backlog | 9 | 52 |
| À faire | 0 | 0 |
| En cours | 0 | 0 |
| Revue | 0 | 0 |
| **Total (hors epics)** | **34** | **168** |

> Les 6 epics (KAN-1 → KAN-6) sont des conteneurs sans story points propres ; ils restent au statut Backlog tant que le lot n'est pas clôturé manuellement.

---

## 2. Avancement par epic (lot Bloc 1)

| Epic | Libellé | Chiffrage | SP faits | SP restants | Avancement |
|---|---|---:|---:|---:|---:|
| KAN-1 | [P0] Infra, DevOps & CI/CD | 24 | 24 | 0 | 100 % |
| KAN-2 | [P0] Wiki & éditeur (Tiptap) | 40 | 40 | 0 | 100 % |
| KAN-3 | [P0] Liaison automatique (Aho-Corasick) + graphe | 52 | 52 | 0 | 100 % |
| KAN-4 | [P1] Wiki avancé | 24 | 0 | 24 | 0 % |
| KAN-5 | [P2] Cartes · timelines · whiteboards | 28 | 0 | 28 | 0 % |
| KAN-6 | [P2/3] Import/Export · polish · Electron | hors chiffrage | — | — | — |
| **Total** | | **168** | **116** | **52** | **69 %** |

**Périmètre P0 (116 SP) : 100 % livré.** Le reste à faire est intégralement constitué de lots P1 et P2, hors chemin critique du MVP.

---

## 3. Répartition par personne assignée

| Personne | Rôle | Tickets | SP faits | SP restants |
|---|---|---:|---:|---:|
| Fabrice Ervé | Dev front | 11 | 38 | 38 |
| Jean Lelio | Dev back | 8 | 34 | 14 |
| Claire Moreau | DevOps | 6 | 24 | 0 |
| Stéphane Louis | Architecte | 2 | 20 | 0 |
| Non assigné | — | 7 | 0 | 0 |

Les 7 tickets non assignés (KAN-33 à KAN-40, hors KAN-37) sont des tâches transverses créées en cours de route — recette, onboarding, passe visuelle, correctifs — sans story points saisis. Elles n'entrent donc pas dans le calcul de la vélocité mais représentent une charge réelle non tracée : **point d'amélioration pour le prochain cycle**.

---

## 4. Indicateurs de pilotage

| Indicateur | Valeur |
|---|---|
| Avancement global (SP) | **116 / 168 → 69,0 %** |
| Avancement périmètre P0 | **116 / 116 → 100 %** |
| Tickets terminés | 25 / 34 (73,5 %) |
| j/h consommés estimés | **58 j/h** (116 SP × 0,5) |
| Budget total | 84 j/h |
| Écart budgétaire | **−26 j/h** (reste 31 % du budget) |
| Reste à faire | 52 SP ≈ 26 j/h |
| Écart consommé / avancement | 0 — la consommation suit exactement l'avancement (dérive nulle sur les lots chiffrés) |

**Throughput** — 25 tickets passés en « Terminé » entre le 11 et le 23 juillet, soit ~2 tickets/jour ouvré et une vélocité moyenne de **~58 SP/semaine** sur la période active (2 semaines).

Dernière mise à jour observée sur un ticket : **24 juillet 2026** (KAN-33). Aucune activité enregistrée sur les 7 derniers jours → **throughput de la semaine écoulée : 0 ticket, 0 SP.**

---

## 5. Détail des tickets terminés (par date de mise à jour)

| Date | Ticket | SP | Résumé |
|---|---|---:|---|
| 11/07 | KAN-7 | 4 | Initialiser le repo : conventions Git, Docker Compose de dev, TS strict |
| 11/07 | KAN-8 | 4 | Modéliser le schéma PostgreSQL avec Prisma |
| 15/07 | KAN-9 | 6 | CI GitHub Actions (lint, tests, couverture bloquante, build) |
| 15/07 | KAN-13 | 4 | Mondes : création, liste, paramètres de base |
| 15/07 | KAN-14 | 8 | CRUD entités avec alias |
| 15/07 | KAN-15 | 10 | Éditeur Tiptap : mise en forme riche + auto-save debouncé |
| 15/07 | KAN-20 | 8 | Worker asynchrone + abstraction JobQueue (pg-boss) |
| 16/07 | KAN-21 | 8 | Détection serveur asynchrone des entités → relations `origin=AUTO` |
| 17/07 | KAN-11 | 4 | MinIO via abstraction S3 (buckets privés, URLs signées) |
| 17/07 | KAN-12 | 8 | Authentification Better Auth |
| 17/07 | KAN-22 | 8 | Surlignage des liaisons + mentions manuelles `@` |
| 17/07 | KAN-24 | 4 | Backlinks sur chaque fiche d'entité |
| 17/07 | KAN-34 | — | Tests end-to-end (smoke Playwright) + câblage CI |
| 18/07 | KAN-10 | 6 | CD : ghcr.io → VPS OVH (SSH) + Traefik/TLS |
| 18/07 | KAN-23 | 4 | Garde-fous de la liaison : ignorer / délier une occurrence |
| 18/07 | KAN-25 | 8 | Graphe de relations Cytoscape.js |
| 20/07 | KAN-16 | 4 | Upload d'images vers MinIO depuis l'éditeur |
| 20/07 | KAN-17 | 3 | Recherche basique dans les entités d'un monde |
| 20/07 | KAN-18 | 3 | Quotas freemium du tier gratuit |
| 21/07 | KAN-39 | — | Bug — collage HTML externe (Obsidian) dans l'éditeur |
| 22/07 | KAN-19 | 12 | Module Aho-Corasick maison (TS pur) + tests unitaires |
| 22/07 | KAN-35 | — | Monde d'introduction créé à l'inscription (parcours démo) |
| 22/07 | KAN-36 | — | Passe visuelle pré-gel : shadcn/ui sur le parcours démo |
| 23/07 | KAN-37 | — | Supervision v1 : `/api/health` + sonde externe + heartbeat sauvegarde |
| 23/07 | KAN-40 | — | Bug — recette v1.2.0-rc.1 : 3 bloquants avant tag prod |

## 6. Reste à faire

| Ticket | Epic | SP | Assigné | Résumé |
|---|---|---:|---|---|
| KAN-26 | KAN-4 | 6 | Fabrice Ervé | Templates de fiches d'entités |
| KAN-27 | KAN-4 | 6 | Jean Lelio | Secrets par rôle |
| KAN-28 | KAN-4 | 8 | Jean Lelio | Recherche full-text dans un monde |
| KAN-29 | KAN-4 | 4 | Fabrice Ervé | Partage public en lecture d'un monde |
| KAN-30 | KAN-5 | 12 | Fabrice Ervé | Cartes interactives (Leaflet CRS.Simple) |
| KAN-31 | KAN-5 | 8 | Fabrice Ervé | Frises chronologiques d'événements |
| KAN-32 | KAN-5 | 8 | Fabrice Ervé | Whiteboards / tableaux infinis |
| KAN-33 | — | — | — | Amélioration visuelle : design system + polish |
| KAN-38 | KAN-4 | — | — | Dossiers dans la sidebar |

---

## 7. Points de vigilance

- **Deadline du 24 juillet (dépôt Bloc 2) : tenue.** Les trois epics P0 (KAN-1, KAN-2, KAN-3 — 116 SP) étaient tous à 100 % au 23 juillet, dernier ticket clôturé KAN-37 (supervision) et KAN-40 (recette v1.2.0-rc.1). Aucun retard P0 à signaler.
- **Charge non chiffrée.** 8 tickets créés en cours de route (KAN-33 à KAN-40) n'ont pas de story points. La consommation réelle est donc probablement supérieure aux 58 j/h estimés. À corriger : saisir systématiquement le champ SP à la création, y compris pour les bugs et tâches de recette.
- **Board à deux colonnes.** L'absence de statuts intermédiaires (« En cours », « Revue ») limite la lisibilité du flux et empêche de mesurer un lead time ou un temps de cycle. Une colonne « En cours » suffirait à produire ces indicateurs pour le prochain snapshot.
- **Activité nulle sur la semaine écoulée** (27 juillet – 3 août) : aucun ticket mis à jour depuis le 24 juillet. Cohérent avec la fin du sprint MVP et le dépôt Bloc 2, mais les 52 SP P1/P2 restants n'ont pas encore été replanifiés.
- **Concentration sur le front.** 38 des 52 SP restants (73 %) sont assignés à Fabrice Ervé. Un rééquilibrage sera nécessaire si les lots P1 et P2 sont lancés en parallèle.

---

*Snapshot généré automatiquement en lecture seule — aucun ticket créé ni modifié sur Jira.*
