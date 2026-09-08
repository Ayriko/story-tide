# Snapshot de pilotage — Story Tide (Jira KAN)

**Date du relevé :** samedi 5 septembre 2026
**Source :** Jira Cloud `story-tide.atlassian.net`, projet KAN (« storytide-team », Kanban team-managed)
**Requête :** `project = KAN` — 54 tickets récupérés (page unique, pas de pagination nécessaire)
**Mode :** lecture seule (aucun ticket créé ni modifié)
**Référentiel :** 168 SP au périmètre MVP, 1 SP ≈ 0,5 j/h → budget 84 j/h
**Certification :** RNCP39583 — Bloc 3, compétence C3.2.1 (indicateurs de délais, coûts, avancement)

---

## 1. Répartition par statut

Le workflow du board n'expose que deux statuts réellement utilisés à la date du relevé (`Backlog` et `Terminé`) ; les colonnes « À faire », « En cours » et « Revue » n'ont aucun ticket positionné.

| Statut | Tickets | dont chiffrés | Story points |
|---|---:|---:|---:|
| Backlog | 22 | 7 | 52 |
| À faire | 0 | 0 | 0 |
| En cours | 0 | 0 | 0 |
| Revue | 0 | 0 | 0 |
| Terminé | 32 | 19 | 116 |
| **Total** | **54** | **26** | **168** |

Répartition par type : 39 Story, 6 Epic, 5 Tâche, 4 Bug.
Les 6 epics et 22 tickets d'exploitation / produit ne portent pas de story points (hors chiffrage MVP).

---

## 2. Avancement par epic (lot)

| Epic | Intitulé | Priorité | SP total | SP faits | SP restants | Avancement |
|---|---|---|---:|---:|---:|---:|
| KAN-1 | Infra, DevOps & CI/CD | P0 | 24 | 24 | 0 | 100 % |
| KAN-2 | Wiki & éditeur (Tiptap) | P0 | 40 | 40 | 0 | 100 % |
| KAN-3 | Liaison automatique (Aho-Corasick) + graphe | P0 | 52 | 52 | 0 | 100 % |
| KAN-4 | Wiki avancé | P1 | 24 | 0 | 24 | 0 % |
| KAN-5 | Cartes · timelines · whiteboards | P2 | 28 | 0 | 28 | 0 % |
| KAN-6 | Import/Export · polish · Electron | P2/3 | — | — | — | hors chiffrage (`wont-v1`) |
| | **Total MVP** | | **168** | **116** | **52** | **69,0 %** |

Le socle P0 (116 SP, soit les trois epics critiques) est intégralement terminé. Le reste à faire porte exclusivement sur P1 et P2.

---

## 3. Répartition des story points par personne

| Personne | Rôle | SP assignés | SP terminés | SP restants | j/h consommés |
|---|---|---:|---:|---:|---:|
| Fabrice Ervé | Dev front | 76 | 38 | 38 | 19,0 |
| Jean Lelio | Dev back | 48 | 34 | 14 | 17,0 |
| Claire Moreau | DevOps | 24 | 24 | 0 | 12,0 |
| Stéphane Louis | Architecte | 20 | 20 | 0 | 10,0 |
| Ayrik Paul | PO | 0 | 0 | 0 | 0,0 |
| Non assigné | — | 0 | 0 | 0 | 0,0 |
| **Total** | | **168** | **116** | **52** | **58,0** |

Les 22 tickets non chiffrés (exploitation, bugs de bêta, documentation, RH) sont actuellement non assignés dans Jira.

---

## 4. Indicateurs de pilotage

| Indicateur | Valeur |
|---|---|
| Avancement global (SP) | **116 / 168 → 69,0 %** |
| Avancement en tickets chiffrés | 19 / 26 → 73,1 % |
| j/h consommés estimés (SP faits × 0,5) | **58,0 j/h** |
| Budget total | 84,0 j/h |
| Consommation du budget | 69,0 % |
| Reste à faire estimé (52 SP × 0,5) | 26,0 j/h |
| Écart budget / reste à faire | **0,0 j/h** (reste à faire = budget résiduel) |
| Avancement du périmètre P0 | 116 / 116 → 100 % |

Le projet est à l'équilibre : la consommation estimée progresse exactement au rythme du périmètre livré, sans dérive de charge à la date du relevé.

---

## 5. Throughput récent

**Sur les 7 derniers jours (29/08 → 05/09) : 0 ticket passé à « Terminé ».**
Aucun ticket du projet n'a été mis à jour depuis le **27/08/2026**.

Dernières clôtures identifiables via le champ `updated` :

| Date | Ticket | Intitulé |
|---|---|---|
| 27/08 | KAN-56 | Artwork de marque sur connexion / inscription |
| 19/08 | KAN-52 | Réinitialisation de mot de passe en autonomie |
| 19/08 | KAN-53 | BUG-014 — zone morte d'édition |
| 17/08 | KAN-43 | Game day — exercice de réponse à incident (staging) |
| 14/08 | KAN-45 | Footer — mentions légales + contact |
| 13/08 | KAN-44 | CD — CHANGELOG daté + version au tag |
| 11/08 | KAN-42 | Documentation du processus de mise à jour des dépendances |

*Réserve méthodologique : le champ `updated` sert ici d'approximation de la date de passage en « Terminé » (aucun `resolutiondate` renseigné sur le projet). Les chiffres de throughput sont donc indicatifs.*

---

## 6. Points de vigilance

- **Aucun epic P0 n'est en retard sur la deadline du 24 juillet (dépôt Bloc 2).** Les 116 SP des lots KAN-1, KAN-2 et KAN-3 ont tous été clôturés au plus tard le 22/07, et le ticket de supervision KAN-37 le 23/07. Le jalon est tenu.
- **Cohérence du board :** les epics KAN-1, KAN-2 et KAN-3 restent au statut `Backlog` alors que 100 % de leurs stories sont terminées. Passer ces trois epics en « Terminé » rendrait le board directement lisible pour un jury, sans changer les chiffres d'avancement.
- **Statuts intermédiaires inutilisés :** aucun ticket n'a jamais été positionné en « En cours » ou « Revue ». Le board ne permet donc pas de mesurer un temps de cycle. À défaut de reconstituer l'historique, mentionner cette limite dans le dossier plutôt que de l'ignorer.
- **Activité en pause depuis le 27/08** (9 jours sans mise à jour). Attendu si la période correspond à une pause estivale ou à une phase de rédaction du dossier ; à consigner comme tel dans le dev-log pour éviter une lecture de dérive.
- **22 tickets sur 54 sont hors chiffrage** (bugs de bêta, exploitation, RH, documentation). Ils ne pèsent pas dans les 84 j/h alors qu'ils consomment du temps réel : envisager une estimation même grossière sur le lot post-S30, l'indicateur de coût gagnerait en robustesse pour C3.2.1.
- **Concentration sur le front :** Fabrice Ervé porte 38 des 52 SP restants (73 %). Le reste à faire P1/P2 est structurellement mono-ressource — à surveiller si le périmètre post-MVP est réactivé.

---

*Snapshot généré automatiquement depuis le connecteur Atlassian (lecture seule). Les story points proviennent du champ `customfield_10016`.*
