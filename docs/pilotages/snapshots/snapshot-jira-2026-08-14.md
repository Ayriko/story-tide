# Snapshot de pilotage — Story Tide

**Date du relevé :** vendredi 14 août 2026
**Source :** Jira Cloud `story-tide.atlassian.net`, projet **KAN** (« storytide-team », Kanban team-managed)
**Requête :** `project = KAN` — 48 tickets récupérés (6 epics + 42 tickets de travail)
**Champ story points :** `customfield_10016` · Conversion : **1 SP ≈ 0,5 j/h**
**Référentiel :** certification RNCP39583 — Bloc 3, compétence **C3.2.1** (éliminatoire) : indicateurs mesurables de délais, coûts et avancement.
**Mode :** lecture seule — aucun ticket créé ni modifié.

---

## 1. Répartition par statut

Statuts réellement présents dans le workflow du projet : **Backlog**, **À faire**, **Terminé**. Les colonnes « En cours » et « Revue » n'hébergent aucun ticket au moment du relevé.

| Statut | Catégorie Jira | Tickets | SP chiffrés | Part des SP |
|---|---|---:|---:|---:|
| Backlog | À faire | 19 | 52 | 31,0 % |
| À faire | En cours | 1 | 0 | 0,0 % |
| Terminé | Terminé | 28 | 116 | 69,0 % |
| **Total** | | **48** | **168** | **100 %** |

> Les 6 epics (KAN-1 à KAN-6) portent le statut Backlog mais aucun SP propre : le chiffrage est porté par leurs stories filles. Ils sont comptés dans les tickets, pas dans les SP.

---

## 2. Avancement par epic (lots du Bloc 1)

| Epic | Lot | SP total | SP faits | SP restants | Avancement |
|---|---|---:|---:|---:|---:|
| KAN-1 | [P0] Infra, DevOps & CI/CD | 24 | 24 | 0 | **100 %** |
| KAN-2 | [P0] Wiki & éditeur (Tiptap) | 40 | 40 | 0 | **100 %** |
| KAN-3 | [P0] Liaison Aho-Corasick + graphe | 52 | 52 | 0 | **100 %** |
| KAN-4 | [P1] Wiki avancé | 24 | 0 | 24 | 0 % |
| KAN-5 | [P2] Cartes · timelines · whiteboards | 28 | 0 | 28 | 0 % |
| KAN-6 | [P2/3] Import/Export · polish · Electron | hors chiffrage | — | — | — |
| **Total MVP** | | **168** | **116** | **52** | **69,0 %** |

**Les trois epics P0 (116 SP, périmètre Must / livrable S30) sont clos à 100 %.** Le reste à faire (52 SP) porte exclusivement sur les lots P1 et P2, explicitement hors livrable S30.

---

## 3. Répartition des SP par personne assignée

| Personne | Rôle | SP faits | SP restants | SP total | Avancement |
|---|---|---:|---:|---:|---:|
| Fabrice Ervé | Dev front | 38 | 38 | 76 | 50,0 % |
| Jean Lelio | Dev back | 34 | 14 | 48 | 70,8 % |
| Claire Moreau | DevOps | 24 | 0 | 24 | 100 % |
| Stéphane Louis | Architecte | 20 | 0 | 20 | 100 % |
| Ayrik Paul | PO | 0 | 0 | 0 | — |
| Non assigné | — | 0 | 0 | 0 | — |
| **Total** | | **116** | **52** | **168** | **69,0 %** |

Le reste à faire chiffré est concentré sur Fabrice Ervé (38 SP, soit 73 % du reliquat), du fait des lots P2 cartes/timelines/whiteboards intégralement front.

---

## 4. Indicateurs de pilotage

| Indicateur | Valeur |
|---|---|
| Avancement global (SP) | **116 / 168 SP — 69,0 %** |
| Avancement des lots P0 (livrable S30) | **116 / 116 SP — 100 %** |
| j/h consommés estimés | **58 j/h** (116 SP × 0,5) |
| Budget de référence | **84 j/h** (168 SP × 0,5) |
| Reste à faire estimé | **26 j/h** |
| Écart budget | **−26 j/h** consommés sous le budget total, soit 69,0 % du budget engagé |
| Tickets clos | 28 / 48 (58,3 %) |
| Tickets ouverts | 20 / 48 (41,7 %) — dont 1 en cours de traitement |

**Lecture coûts.** Le chiffrage de 168 SP / 84 j/h est gelé et sert de référence au burn-up. Les 58 j/h consommés correspondent strictement aux tickets chiffrés du Bloc 1. Les tickets ouverts après le chiffrage initial (supervision, recette, correctifs, polish — KAN-33 à KAN-50) sont volontairement **hors chiffrage** et non convertis en j/h, afin de ne pas fausser la comparaison au budget de référence.

---

## 5. Throughput de la semaine (8 → 14 août 2026)

Tickets passés à « Terminé » sur la semaine, identifiés via le champ `updated` :

| Ticket | Type | Intitulé | Dernière MAJ | SP |
|---|---|---|---|---:|
| KAN-42 | Tâche | Documenter le processus de mise à jour des dépendances | 11/08 | — |
| KAN-44 | Tâche | CD — automatiser CHANGELOG daté + version `package.json` au tag | 13/08 | — |
| KAN-45 | Story | Footer — mentions légales + contact@storytide.fr (canal bêta) | 14/08 | — |

**Throughput : 3 tickets clos, 0 SP chiffré** — la semaine a porté sur des travaux hors chiffrage MVP (outillage CD, documentation de maintenance, mise en conformité du footer), tous liés à la release **v1.3.0** du 13/08.

**En cours au moment du relevé :** KAN-43 — *Game day, exercice de réponse à incident sur staging* (statut « À faire », catégorie En cours, MAJ 13/08).

---

## 6. Points de vigilance

- **Aucun retard sur les lots P0 vis-à-vis de la deadline du 24 juillet (dépôt Bloc 2).** Les trois epics P0 — Infra (24 SP), Wiki & éditeur (40 SP), Liaison Aho-Corasick (52 SP) — sont clos à 100 %, ainsi que les travaux de supervision (KAN-37), de recette (KAN-40) et de passe visuelle (KAN-36) menés avant le gel. L'échéance est tenue.

- **Le reliquat chiffré (52 SP / 26 j/h) est intégralement P1-P2, hors livrable S30.** Il n'engage pas la deadline Bloc 2 ; sa planification relève des arbitrages v1.3 / v1.4.

- **Un seul ticket en cours pour toute l'équipe.** Le WIP très bas (KAN-43 seul) est cohérent avec une semaine post-release, mais mérite d'être surveillé : si le backlog non chiffré (KAN-33, KAN-38, KAN-46, KAN-47, KAN-48, KAN-50) reste sans mise en cours, le jalon de mi-septembre se rapproche sans flux mesurable.

- **KAN-47 (coexistence de styles / blocs `contentBody`) porte un GO/NO-GO au 26 août**, conditionné au merge préalable de KAN-38 et du lot démo KAN-33. Aucun des deux n'est démarré à ce jour — l'hypothèse d'un NO-GO et d'un report en v1.4 est à considérer sereinement dès maintenant plutôt qu'en fin de fenêtre.

- **Concentration de charge sur le profil dev front.** 38 des 52 SP restants reposent sur une seule personne. Sans impact à court terme (lots non planifiés), mais point à intégrer au plan de développement des compétences de KAN-50.

---

## 7. Notes méthodologiques

- Les statuts retenus sont ceux réellement renvoyés par l'API — le workflow du projet n'expose que Backlog, À faire et Terminé. Aucun mapping vers un référentiel théorique n'a été forcé.
- Le throughput est estimé à partir du champ `updated`, seul horodatage disponible dans la requête ; il constitue une approximation de la date de clôture réelle et peut inclure des mises à jour de contenu sans changement de statut.
- Les tickets sans story points (KAN-33 à KAN-50, hors KAN-38) sont comptés en volume mais exclus des agrégats SP et j/h, conformément au principe de chiffrage gelé.
- Les epics sont exclus des agrégats SP pour éviter tout double comptage avec leurs stories filles.

---

*Relevé produit automatiquement — lecture seule sur Jira. Projet KAN, 48 tickets, cloudId `48421212-bfd8-4bc7-8412-2883bffb2b55`.*
