# Snapshot de pilotage — Story Tide (projet Jira KAN)

**Date du relevé :** vendredi 28 août 2026
**Source :** Jira Cloud `story-tide.atlassian.net` — projet KAN (« storytide-team », Kanban team-managed)
**Requête :** `project = KAN` — 54 tickets récupérés (lecture seule, aucun ticket créé ni modifié)
**Référentiel :** certification RNCP39583, Bloc 3, compétence C3.2.1 (indicateurs de délais, coûts et avancement)
**Conversion budgétaire :** 1 SP ≈ 0,5 j/h — budget MVP = 168 SP ≈ 84 j/h

---

## 1. Répartition par statut

Le board KAN n'utilise que deux statuts réels : **Backlog** et **Terminé**. Les colonnes « À faire », « En cours » et « Revue » ne sont pas alimentées — il n'existe donc pas de mesure d'en-cours (WIP) exploitable à ce jour.

| Statut | Tickets | % tickets | Story points | % SP chiffrés |
|---|---:|---:|---:|---:|
| Backlog | 22 | 40,7 % | 52 | 31,0 % |
| Terminé | 32 | 59,3 % | 116 | 69,0 % |
| **Total** | **54** | **100 %** | **168** | **100 %** |

> 28 tickets sur 54 ne portent aucun story point (6 épopées + 22 tickets d'exploitation, correctifs et dette ajoutés après le chiffrage initial). Ils sont comptés en volume mais restent hors du budget de 84 j/h.

## 2. Avancement par épopée (lot)

| Épopée | Libellé | SP total | SP faits | SP restants | Avancement | Statut |
|---|---|---:|---:|---:|---:|---|
| KAN-1 | [P0] Infra, DevOps & CI/CD | 24 | 24 | 0 | 100 % | Clos |
| KAN-2 | [P0] Wiki & éditeur (Tiptap) | 40 | 40 | 0 | 100 % | Clos |
| KAN-3 | [P0] Liaison Aho-Corasick + graphe | 52 | 52 | 0 | 100 % | Clos |
| KAN-4 | [P1] Wiki avancé | 24 | 0 | 24 | 0 % | Non démarré |
| KAN-5 | [P2] Cartes · timelines · whiteboards | 28 | 0 | 28 | 0 % | Non démarré |
| KAN-6 | [P2/3] Import/Export · polish · Electron | — | — | — | hors chiffrage | Non démarré |
| **Total** | | **168** | **116** | **52** | **69,0 %** | |

Détail du rattachement : KAN-1 → KAN-7 à 11 + KAN-37 ; KAN-2 → KAN-12 à 18 ; KAN-3 → KAN-19 à 25 ; KAN-4 → KAN-26 à 29 + KAN-38 ; KAN-5 → KAN-30 à 32 ; KAN-6 → aucun enfant. 20 tickets (KAN-33 à KAN-56, hors KAN-37/38) ne sont rattachés à aucune épopée.

## 3. Répartition par personne assignée

| Personne | Rôle | Tickets | SP portés | SP faits | SP restants |
|---|---|---:|---:|---:|---:|
| Fabrice Ervé | Dev front | 14 | 76 | 38 | 38 |
| Jean Lelio | Dev back | 8 | 48 | 34 | 14 |
| Claire Moreau | DevOps | 7 | 24 | 24 | 0 |
| Stéphane Louis | Architecte | 3 | 20 | 20 | 0 |
| Ayrik Paul | PO | 0 | 0 | 0 | 0 |
| Non assigné | — | 22 | 0 | 0 | 0 |
| **Total** | | **54** | **168** | **116** | **52** |

## 4. Indicateurs de délais, coûts et avancement

| Indicateur | Valeur |
|---|---|
| Avancement en story points | **116 / 168 SP — 69,0 %** |
| Avancement en tickets | 32 / 54 — 59,3 % |
| Charge consommée estimée | **58 j/h** (116 SP × 0,5) |
| Budget MVP | 84 j/h |
| Reste à faire estimé | 26 j/h (52 SP) |
| Écart budget / consommé | **0 j/h** — consommé strictement proportionnel à l'avancé |
| Throughput de la semaine (7 j glissants) | 1 ticket terminé (KAN-56, 0 SP) |
| Tickets en cours / en revue | 0 (statuts non utilisés sur le board) |

**Throughput détaillé (23 → 28 août 2026)**

| Ticket | Libellé | SP | Mis à jour |
|---|---|---:|---|
| KAN-56 | Artwork de marque en fond des écrans de connexion et d'inscription | — | 27/08/2026 |

## 5. Points de vigilance

- **Aucun retard sur le périmètre P0.** Les trois épopées prioritaires (KAN-1, KAN-2, KAN-3 — 116 SP) sont intégralement terminées. L'échéance du 24 juillet (dépôt Bloc 2) ne constitue donc pas un risque sur ce périmètre : elle est passée et les lots critiques étaient livrés.
- **Le reste à faire est entièrement P1/P2** (KAN-4 : 24 SP, KAN-5 : 28 SP), sans engagement de date connu à ce stade. Aucun de ces deux lots n'est démarré, ce qui est cohérent avec une priorisation P0 d'abord, mais laisse 52 SP (26 j/h) non entamés.
- **Concentration de la charge restante sur Fabrice Ervé** : 38 des 52 SP restants (73 %) lui sont assignés. Un rééquilibrage ou un séquencement explicite serait prudent avant de démarrer KAN-4 et KAN-5.
- **Le board ne permet pas de mesurer l'en-cours.** Sans statuts intermédiaires (En cours / Revue), impossible de calculer un WIP, un temps de cycle ou un lead time. C'est la principale limite du dispositif d'indicateurs actuel au regard de C3.2.1.
- **La charge consommée est déduite, pas mesurée.** Le calcul j/h = SP × 0,5 produit mécaniquement un écart nul. Pour un indicateur de coût réellement contradictoire, il faudrait saisir des worklogs Jira (temps passé) et les comparer à l'estimation.
- **28 tickets sur 54 sont hors chiffrage**, dont 13 déjà terminés. Le travail réel effectué dépasse donc les 58 j/h calculés — le budget affiché sous-estime la charge consommée.

---

## Annexe — hypothèses retenues

- Statuts réels lus dans Jira : `Backlog` (catégorie « À faire ») et `Terminé` (catégorie « Terminé »). Le tableau du §1 les reprend tels quels plutôt que la nomenclature à cinq colonnes.
- Throughput calculé sur le champ `updated` (7 jours glissants), à défaut d'un champ de date de résolution renseigné.
- Rattachement aux épopées vérifié ticket par ticket via `parent = KAN-n`, non déduit de la numérotation.
- KAN-41 et KAN-49 n'existent pas dans le projet (clés absentes).
- L'année de l'échéance « 24 juillet » n'était pas précisée ; elle est traitée comme antérieure à la date du relevé.
