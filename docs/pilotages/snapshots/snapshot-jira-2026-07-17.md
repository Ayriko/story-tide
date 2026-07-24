# Snapshot de pilotage — Story Tide

**Date :** 2026-07-17 (vendredi)
**Projet Jira :** KAN — storytide-team (Kanban team-managed)
**Périmètre MVP (Bloc 1) :** 168 SP ≈ 84 j/h (1 SP ≈ 0,5 j/h)
**Certification :** RNCP39583 — Bloc 3, compétence C3.2.1 (indicateurs délais / coûts / avancement)
**Source :** JQL `project = KAN` — 34 tickets (6 epics + 28 stories), lecture seule.

---

## 1. Avancement par statut (stories)

| Statut | Tickets | Story points |
|---|---:|---:|
| Backlog | 15 | 84 |
| En cours (WIP 4) | 4 | 20 |
| Terminé | 9 | 64 |
| **Total** | **28** | **168** |

> Le board team-managed ne comporte pas de colonnes « À faire » ni « Revue » : les statuts réels sont Backlog / En cours (WIP 4) / Terminé.

---

## 2. Avancement par epic (lots Bloc 1)

| Epic | Lot | SP total | SP faits | SP restants |
|---|---|---:|---:|---:|
| KAN-1 | [P0] Infra, DevOps & CI/CD | 24 | 14 | 10 |
| KAN-2 | [P0] Wiki & éditeur (Tiptap) | 40 | 22 | 18 |
| KAN-3 | [P0] Liaison auto (Aho-Corasick) + graphe | 52 | 28 | 24 |
| KAN-4 | [P1] Wiki avancé | 24 | 0 | 24 |
| KAN-5 | [P2] Cartes · timelines · whiteboards | 28 | 0 | 28 |
| KAN-6 | [P2/3] Import/Export · polish · Electron | hors chiffrage | — | — |
| **Total** | | **168** | **64** | **104** |

**Sous-total P0 (KAN-1 à KAN-3) :** 116 SP dont 64 faits → **52 SP restants** (~26 j/h).

---

## 3. Répartition par personne assignée (stories)

| Personne | SP total | SP faits | SP restants |
|---|---:|---:|---:|
| Fabrice Ervé (dev front) | 76 | 14 | 62 |
| Jean Lelio (dev back) | 48 | 16 | 32 |
| Claire Moreau (DevOps) | 24 | 14 | 10 |
| Stéphane Louis (architecte) | 20 | 20 | 0 |
| Non assigné | 0 | 0 | 0 |

> Charge restante concentrée sur Fabrice Ervé (62 SP), qui porte le front des epics P0/P1/P2.

---

## 4. Indicateurs de pilotage

| Indicateur | Valeur |
|---|---|
| Avancement global | **38,1 %** (64 / 168 SP) |
| SP en cours (WIP) | 20 SP |
| SP restants | 104 SP |
| j/h consommés (estimés) | **32 j/h** (64 SP × 0,5) |
| Budget | 84 j/h |
| Écart au budget | **−52 j/h** (52 j/h non encore consommés) |

---

## 5. Throughput de la semaine

Tickets passés « Terminé » avec `updated` durant la semaine (lun. 13 → 17 juillet) :

| Ticket | Epic | SP | Terminé le |
|---|---|---:|---|
| KAN-9 | KAN-1 | 6 | 2026-07-15 |
| KAN-13 | KAN-2 | 4 | 2026-07-15 |
| KAN-14 | KAN-2 | 8 | 2026-07-15 |
| KAN-15 | KAN-2 | 10 | 2026-07-15 |
| KAN-19 | KAN-3 | 12 | 2026-07-15 |
| KAN-20 | KAN-3 | 8 | 2026-07-15 |
| KAN-21 | KAN-3 | 8 | 2026-07-16 |

**Throughput semaine : 7 tickets / 56 SP.** (KAN-7 et KAN-8, 4 SP chacun, ont été terminés la semaine précédente — 11 juillet.)

En cours actuellement : KAN-11 (Infra, 4), KAN-12 (Auth, 8), KAN-22 (surlignage liaisons, 8), KAN-34 (tests E2E, 0).

---

## 6. Points de vigilance

Échéance **24 juillet (dépôt Bloc 2)** → 1 semaine. Il reste **52 SP de P0** (~26 j/h) répartis entre les trois epics, dont 24 SP sur KAN-3 (liaison Aho-Corasick / graphe), l'epic le plus lourd et le moins avancé en absolu. Au rythme observé cette semaine (56 SP livrés), la clôture des P0 avant le 24 reste atteignable mais tendue : à surveiller en priorité KAN-3 (graphe Cytoscape KAN-25, backlinks KAN-24, garde-fous KAN-23) et la finalisation des items en cours (KAN-11, KAN-12, KAN-22). Les lots P1 (KAN-4) et P2 (KAN-5) sont encore à 0 % — cohérent avec leur priorité, mais hors périmètre du dépôt si celui-ci vise le socle P0.

---

*Snapshot généré automatiquement en lecture seule sur Jira. Aucun ticket créé ni modifié.*

## Capture

`docs/pilotages/captures/2026-07-17-board.png` — capture du board à cette date.
