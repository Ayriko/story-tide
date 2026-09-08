# Snapshot de pilotage — Story Tide

**Date du relevé :** lundi 24 août 2026
**Source :** Jira Cloud `story-tide.atlassian.net`, projet **KAN** (storytide-team) — JQL `project = KAN`, 53 tickets, lecture seule.
**Référentiel de chiffrage :** 168 SP gelés (Bloc 1, C1.4.1) · 1 SP ≈ 0,5 j/h · budget 84 j/h.
**Compétence visée :** C3.2.1 (indicateurs mesurables délais / coûts / avancement) — RNCP39583, Bloc 3.

---

## 1. Répartition par statut

Le workflow du board ne renvoie que deux statuts actifs à cette date : **Backlog** (catégorie « A faire ») et **Terminé**. Aucun ticket n'est en « En cours » ni en « Revue » au moment du relevé.

| Statut | Tickets | Story points |
|---|---:|---:|
| Backlog | 22 | 52 |
| En cours | 0 | 0 |
| Revue | 0 | 0 |
| Terminé | 31 | 116 |
| **Total** | **53** | **168** |

Les 22 tickets en Backlog incluent les 6 epics (KAN-1 à KAN-6), qui ne portent pas de SP propres.

---

## 2. Avancement par epic (lot Bloc 1)

| Epic | Lot | SP prévus | SP faits | SP restants | Avancement |
|---|---|---:|---:|---:|---:|
| KAN-1 | P0 — Infra, DevOps & CI/CD | 24 | 24 | 0 | 100 % |
| KAN-2 | P0 — Wiki & éditeur (Tiptap) | 40 | 40 | 0 | 100 % |
| KAN-3 | P0 — Liaison Aho-Corasick + graphe | 52 | 52 | 0 | 100 % |
| KAN-4 | P1 — Wiki avancé | 24 | 0 | 24 | 0 % |
| KAN-5 | P2 — Cartes · timelines · whiteboards | 28 | 0 | 28 | 0 % |
| KAN-6 | P2/3 — Import/export · Electron | hors chiffrage | — | — | — |
| — | Tickets hors epic (17) | 0 | 0 | 0 | n/a |
| **Total** | | **168** | **116** | **52** | **69,0 %** |

**Périmètre P0 (livrable S30) : 116 / 116 SP — 100 % terminé.** Le reste du chiffrage (52 SP) correspond aux lots P1 et P2, explicitement hors livrable S30.

---

## 3. Répartition par personne assignée

| Personne | Rôle | SP assignés | SP faits | SP restants |
|---|---|---:|---:|---:|
| Fabrice Ervé | Dev front | 76 | 38 | 38 |
| Jean Lelio | Dev back | 48 | 34 | 14 |
| Claire Moreau | DevOps | 24 | 24 | 0 |
| Stéphane Louis | Architecte | 20 | 20 | 0 |
| Ayrik Paul | PO | 0 | 0 | 0 |
| Non assigné | — | 0 | 0 | 0 |
| **Total** | | **168** | **116** | **52** |

Les 52 SP restants (P1/P2) sont portés à 73 % par Fabrice Ervé — point à surveiller si ces lots sont réactivés.

---

## 4. Indicateurs de délais et de coûts

| Indicateur | Valeur |
|---|---|
| Avancement global (SP) | **69,0 %** (116 / 168) |
| Avancement périmètre P0 / MVP S30 | **100 %** (116 / 116) |
| j/h consommés estimés | **58 j/h** (116 SP × 0,5) |
| Budget total | 84 j/h |
| Écart au budget | **−26 j/h** (soit 31 % de marge non consommée) |
| j/h correspondant au reste à faire | 26 j/h (52 SP, lots P1/P2) |
| Reste à faire sur périmètre P0 | 0 j/h |

Aucun dépassement : la consommation estimée est strictement conforme au chiffrage initial, le solde correspondant intégralement à des lots volontairement non engagés.

---

## 5. Throughput de la semaine (17 → 24 août 2026)

Tickets au statut « Terminé » modifiés sur les 7 derniers jours (approximation par le champ `updated`, le champ `resolutiondate` n'étant pas exploitable sur ce board) :

| Ticket | Titre | SP | Dernière modif. |
|---|---|---:|---|
| KAN-43 | Game day — exercice de réponse à incident sur staging | — | 17/08 |
| KAN-52 | Réinitialisation de mot de passe en autonomie (e-mail de reset) | — | 19/08 |
| KAN-53 | BUG-014 — Zone morte / perte de visibilité d'édition (régression v1.3.0) | — | 19/08 |

Throughput hebdomadaire : **3 tickets terminés, 0 SP**. Ces tickets sont postérieurs au gel du chiffrage et ne portent volontairement pas de story points.

Également touchés cette semaine mais toujours en Backlog : KAN-51 (pages d'erreur, 17/08), KAN-54 (BUG-015 liens, 19/08), KAN-55 (paramètres du compte, 17/08).

---

## 6. Points de vigilance

- **Deadline du 24 juillet (dépôt Bloc 2) : aucun retard P0.** Les trois epics P0 (KAN-1, KAN-2, KAN-3) sont à 100 %, soit 116 SP livrés sur les 116 attendus au MVP S30. Le jalon a été tenu.
- **Le burn-up est figé depuis fin juillet.** Les 17 tickets créés après le gel (KAN-33 à KAN-55) n'ont pas de story points : l'activité réelle de la phase v1.2 → v1.3 (supervision, recette, correctifs, canal bêta) n'apparaît donc pas dans le taux d'avancement, bloqué à 69 % alors que le travail continue. C'est cohérent avec la décision de figer le référentiel, mais l'indicateur perd sa valeur de pilotage sur le cycle courant — envisager un second compteur pour la phase post-MVP.
- **WIP nul au moment du relevé.** Aucun ticket en « En cours » ni en « Revue » : le board ne reflète pas d'en-cours entre deux lots. Si du travail est effectivement engagé sur la fenêtre S35 (24-30/08), passer les tickets concernés en « En cours » rendrait le board plus fidèle et alimenterait un indicateur de temps de cycle.
- **Charge concentrée sur le front.** 38 des 52 SP restants sont assignés à Fabrice Ervé (P1 Wiki avancé + P2 Cartes/timelines) — à rééquilibrer si ces lots sont réouverts.
- **Deux P1 issus du canal bêta en attente d'arbitrage** : KAN-54 (BUG-015, liens sans feedback) reste en Backlog, à rapprocher de KAN-46 (échecs d'auto-save silencieux) — un lot « feedback des actions muettes » se dessine pour la fenêtre S35.

---

## 7. Méthodologie et limites

- Extraction : `searchJiraIssuesUsingJql` sur `project = KAN`, pagination complète (53 / 53 tickets récupérés), champs `summary`, `status`, `issuetype`, `assignee`, `parent`, `customfield_10016` (story points), `updated`. **Aucune écriture Jira.**
- Les SP des epics sont calculés par somme de leurs enfants (les epics eux-mêmes ne portent pas de valeur dans `customfield_10016`).
- Conversion SP → j/h : ratio conventionnel 1 SP = 0,5 j/h, tel que fixé au chiffrage Bloc 1. Il s'agit d'une **estimation de charge**, non d'un temps réellement pointé.
- Le throughput hebdomadaire s'appuie sur `updated` faute de date de résolution exploitable : une modification tardive d'un ticket clos antérieurement pourrait le faire apparaître à tort dans la période.
- Les clés KAN-41 et KAN-49 sont absentes du projet (tickets supprimés) : la numérotation est discontinue, sans incidence sur les totaux.

---

*Snapshot généré automatiquement — tâche planifiée hebdomadaire. Source : [board KAN](https://story-tide.atlassian.net/browse/KAN).*
