# Registre des retours bêta — Story Tide

> Créé le 2026-08-17. Un retour = une entrée datée : canal, contenu, qualification, suite donnée.
> Alimente le backlog produit et les indicateurs de satisfaction. Complète le plan de correction
> (les anomalies signalées y sont consignées sous leur BUG-NNN) — jamais de doublon de fond, des renvois.

## 2026-08-16 — Damien C. (canal contact@, « Retour StoryTide »)

**Sentiment** : positif — facilité d'utilisation, interface claire, liaison automatique, organisation des fichiers, écran « peu chargé ». Usage réel avec **import de plusieurs documents de worldbuilding**. **Aucun bug rencontré.**

| # | Suggestion | Qualification | Suite |
|---|---|---|---|
| 1 | Paramètres d'un monde (renommer/supprimer) depuis l'écran des mondes | Quick-win UX, friction réelle (détour obligé par l'intérieur du monde) | Backlog — candidate arbitrage S35+ |
| 2 | Tableaux dans l'éditeur | Rejoint le chantier blocs de contenu (KAN-47 coexistence styles/contentBody) | Backlog — rattachée à l'architecture de contenu |
| 3 | Mode lecture | Pertinence croissante avec la taille des mondes | Backlog |
| 4 | Raccourcis de création (personnalisables) | Partiellement couverte par la palette Ctrl+K planifiée (lot démo KAN-33) | Backlog — la palette d'abord, personnalisation ensuite |
| 5 | Types de fiches modifiables/ajoutables | Confirme KAN-26 (templates de fiches) — vote utilisateur | KAN-26 renforcé |

**Réponse** : envoyée depuis contact@ le 17/08 (remerciement + statut de chaque suggestion).

## 2026-08-17 — Francesca L. (canal contact@, « Retours sur Story Tide » ×2, captures jointes)

**Sentiment** : positif (« votre site c'est la classe à Dallas ») — filtres de la Constellation efficaces, entrées intuitives, vue claire, zoom agréable. Retour **structuré avec captures** — qualité de signalement exemplaire.

**Anomalies signalées** (consignées au plan de correction) :

| Signalement | Qualification | Renvoi |
|---|---|---|
| « Bloc » en bas d'écran + perte de visibilité (image uploadée, sauts de ligne) — recoupé par un constat interne (zone morte sous le footer) | **P1 provisoire — régression v1.3.0 probable** (layout du conteneur défilant, cas contenu > viewport jamais exercé) | **BUG-014** — correctif visé v1.3.1 |
| Insertion de liens sans effet ni feedback (twitter/pinterest) | P2 provisoire — hypothèses : sélection requise (UX) ou SafeLink silencieux (bug) | **BUG-015** — à reproduire |
| ~~Images uploadées non redimensionnables~~ → poignée invisible sur fond de même couleur (vert/vert) | Levée par la testeuse (2ᵉ mail) — défaut d'affordance, pas de fonction | Note UX rattachée à KAN-39 |

| # | Suggestion | Qualification | Suite |
|---|---|---|---|
| 1 | Masquer d'un geste tout ce qui est lié à une entité (filtre par nœud) | Extension naturelle des filtres existants | Backlog |
| 2 | Police + taille de police dans l'éditeur | Personnalisation éditeur | Backlog |
| 3 | Images au niveau de l'univers | Rejoint les covers (périmètre KAN-33/38) — vote utilisateur | Chantier covers renforcé |
| 4 | Lisibilité Constellation : types de flèches (affection, rivalité…), couleurs personnalisables (types + flèches) | Rejoint le chantier lisibilité (cousin BUG-012) ; les relations typées sont un sujet produit profond (cf. veille vvd) | Backlog — à arbitrer comme lot dédié |
| 5 | Créer des liens manuellement depuis la Constellation (drag entre nœuds) | Belle idée, coût élevé (interactions graphe) | Backlog post-cert |
| 6 | Tag « Espèces » (vs rattachement à « Faune ») | Question de taxonomie des types — rejoint KAN-26/templates | Backlog |
| 7 | Épingler des univers | Quick-win navigation | Backlog |
| 8 | Plusieurs tableaux de constellations par univers | Organisation des gros mondes — forte valeur, coût moyen | Backlog — candidate post-cert |

**Réponse** : envoyée depuis contact@ le 17/08 (statut bug par bug + suggestions).

## 2026-08-16/17 — Deux cas « mot de passe oublié » (hors canal : messagerie privée)

Deux bêta-testeurs bloqués, même cause : **aucune réinitialisation autonome** (l'application n'envoie pas d'e-mails). Traitement : geste de support manuel (aligné sur le régime « manuel assumé » des mentions légales) + **KAN-52 priorisé** (flux Better Auth + première brique e-mail SMTP) — deux utilisateurs bloqués = signal de priorisation maximal. À canaliser vers contact@ pour la traçabilité des prochains cas.

## 2026-08-18 — Tristan M. (canal contact@, « Retours Story Tide », PDF joint, 3 annexes)

**Sentiment** : très positif — site « fonctionnel », interactions « très fluides », aucun ralentissement.
Salue la liaison inter-entrées « extrêmement rapide, voire instantanée, même avec élision », le chargement
instantané des entrées, l'**absence de cookies tiers** (« un point très positif », utilisateur attentif au sujet),
l'UI « très bien organisée », la possibilité d'**ignorer des liens** (son exemple : une entrée « Elfe » redondante
en fantasy), la hiérarchisation automatique de la sidebar et les codes couleurs de la Constellation.
Retour **structuré en trois volets, avec annexes et fiche d'environnement complète** (Windows 11, Firefox,
uBlock Origin) — qualité de signalement exemplaire.

**Anomalies signalées** (consignées au plan de correction) :

| Signalement | Qualification | Renvoi |
|---|---|---|
| Pas de récupération de mot de passe → premier compte perdu (mdp aléatoire créé sur un autre poste), **compte recréé** | 3ᵉ utilisateur touché — confirme la priorité maximale du flux autonome | **KAN-52** — livré en v1.3.1 |
| « Immense fenêtre vide » bloquante après collage d'un long texte (Ctrl+V comme clic droit), F5 inefficace, retour au menu de monde nécessaire (annexe 1) | Recoupement plausible de BUG-014 (contenu > viewport) — arbitré le 18/08 : retest après v1.3.1, entrée dédiée si persistance | **BUG-014** (note du 18/08) |
| Image téléversée **dupliquée** quand on la déplace à la souris dans la zone de texte | P2 provisoire — à reproduire, geste exact demandé | **BUG-016** |
| Liens hypertextes sans effet sur le site **mais présents une fois collés dans Word** | 2ᵉ signalement indépendant + indice fort : mark posée et persistée → défaut côté rendu/activation | **BUG-015** (note du 18/08, KAN-54) |
| Saisies des champs de titre mémorisées et reproposées par le navigateur (annexe 2) | Requalifié (arbitrage du 18/08) : réglage, pas une anomalie — autocomplétion native du navigateur, correctif one-liner `autocomplete="off"` | Note UX au plan de correction |

| # | Suggestion | Qualification | Suite |
|---|---|---|---|
| 1 | Créer une entrée par clic droit sur un mot du texte (voire suggestions automatiques sur les noms propres) | Extension directe du différenciateur liaison, cousine des mentions `@` | Backlog |
| 2 | Types d'entrées personnalisés | **3ᵉ vote utilisateur** (après les retours des 16-17/08) | KAN-26 encore renforcé |
| 3 | Sous-dossiers personnalisés dans la sidebar | Vote utilisateur pour le chantier déjà planifié | KAN-38 renforcé |
| 4 | Personnalisation de l'UI (couleurs) et **mode clair** — le dark mode le gêne (« j'arrive à mieux voir du texte noir sur un fond blanc ») | Croise l'exigence d'accessibilité du projet — un thème clair est un chantier de charte, pas un réglage | Backlog — à arbitrer comme lot dédié |
| 5 | Interdire les doublons de noms d'entrées (le conflit de liaison actuel — aucun lien posé — n'est « jamais perçu clairement ») | Touche un invariant du moteur de liaison ; recoupe le besoin de feedback des actions silencieuses (cf. BUG-015, KAN-46) | Backlog — à instruire avec le moteur |
| 6 | Encart d'image dédié par entrée + miniatures dans la sidebar et la Constellation (annexe 3) | Rejoint les covers d'entité (lot démo) — 2ᵉ vote « images » | Chantier covers (KAN-33/38) renforcé |
| 7 | Plusieurs zones de texte / chapitrage des entrées | Rejoint l'architecture de contenu en blocs | Rattachée à KAN-47 |
| 8 | Mentions légales : indiquer explicitement que **toute création appartient à son auteur**, pas à l'éditeur | Quick-win **documentaire** à fort signal de confiance (« pourrait devenir une force pour le site ») | Candidate immédiate — page /mentions-legales |
| 9 | Arbres généalogiques, chronologies, PDF intégrés aux entrées | Cartes/frises déjà différées en connaissance de cause ; l'intégration de PDF est une piste nouvelle | Backlog — cycle v1.4+ |

**Réponse** : brouillon du 18/08 préparé pour envoi depuis contact@ (statut point par point + questions de
reproduction BUG-015/016 + proposition de récupérer le premier compte + retest de la « fenêtre vide » après v1.3.1).
