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
