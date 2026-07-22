# Contrat de seed — monde d'introduction « Atheraus »

> **Emplacement cible dans le repo :** `docs/contrat-de-seed-atheraus.md`
> **Rédigé le :** 2026-07-19 · **Ticket :** KAN-35 (dépend de KAN-18)
> **Statut :** validé pour la partie schéma (bloc A), à exécuter pour la partie contenu.

## 0. Objet et portée

Ce document fige **la forme** des données du monde d'introduction, avant d'en écrire le contenu. Il ne raconte pas Atheraus : il définit ce que la génération devra respecter pour que le monde soit (a) rejouable, (b) démonstratif du moteur de liaison automatique, (c) lisible en vue graphe.

Il n'est pas un livrable de certification en soi. Il sert à ce que la session de génération de contenu (KAN-35) soit mécanique, et à ce que les captures de la passe visuelle (KAN-36, 21-22/07) portent sur un jeu de données réel.

**Hors périmètre :** images et médias (chantier MinIO + droits d'usage, rouvert pour l'oral Bloc 3) · propriétés typées de carte · blocs JDR.

---

## 1. Invariants techniques

Ces points découlent des décisions KAN-18 et ne sont pas négociables au moment de la génération.

| Invariant | Règle |
|---|---|
| Origine du monde | `World.origin = INTRO` (enum `WorldOrigin`) → exclu du décompte de quota |
| Idempotence | Chaque entité porte un `seedRef` stable et unique. Le script se rejoue sans doublon. **Le slug n'est jamais la clé** (modifiable par l'utilisateur après clonage) |
| Cycle de vie | Le monde est proposé à l'inscription, skippable, supprimable ensuite. S'il est conservé et modifié, il se comporte comme un monde ordinaire |
| Liens | Le seed ne crée **aucune** relation en base. Les relations `AUTO` naissent du passage du worker après insertion — c'est la démonstration elle-même |
| Liens manuels | Les 2-3 mentions manuelles du corpus (§5) produisent des relations `origin = MANUAL`, qu'un re-scan ne doit pas écraser |

**Contrainte de nommage héritée du moteur.** La v1 du module Aho-Corasick ne déplie pas les ligatures (`œ`, `æ`), pour préserver l'alignement des index — limitation tracée en candidat ADR-0001. **Aucun nom ni alias du seed ne doit contenir de ligature.** Les diacritiques ordinaires (`é`, `è`, `ê`, `ï`, `ô`, `ç`) sont au contraire souhaitables : ils exercent la normalisation.

---

## 2. Structure d'une entité

```
{
  seedRef   : string        // stable, unique, ex. "ath-per-elenya"
  name      : string        // forme canonique, sans ligature
  type      : string        // id de type (cf. §3)
  aliases   : string[]      // cf. §4
  summary   : string        // 1-2 phrases, sert la liste et le survol du graphe
  body      : TiptapJSON    // document ProseMirror, cf. ci-dessous
}
```

**Forme du corps.** Document Tiptap valide, composé de titres de niveau 2, de paragraphes, et ponctuellement de listes ou de citations. Pas de nœud custom hors mentions manuelles.

**Encodage des mentions.** Le corps est **du texte nu à ~90 %** : les noms d'entités y apparaissent en prose, sans balisage — c'est exactement ce que le moteur doit détecter seul. Les 2-3 mentions manuelles prévues au §5 sont les seules encodées en nœuds `mention`.

---

## 3. Volume et répartition

**25 entités.** Tous les types ne sont pas couverts, et c'est voulu : un monde d'introduction n'est pas un catalogue de la taxonomie.

| Groupe | Cible | Commentaire |
|---|---|---|
| Lore | 6 | Cœur du récit : ères, schisme, prophétie |
| Organisation | 5 | Le conflit politique d'Atheraus |
| Lieux | 5 | Ancrage géographique |
| Personnages | 4 | Dont 2 nœuds centraux |
| Magie | 2 | Système magique + une pratique |
| Écologie | 2 | Créatures et leur effet sur le milieu |
| Objets | 1 | Un artefact, lié à la prophétie |

Un type peut rester vide. Les groupes vides sont à éviter : la coloration du graphe se fait par groupe, et un groupe absent affaiblit la démonstration du filtre.

---

## 4. Alias

**Densité : 2 à 3 alias par entité en moyenne, jusqu'à 5 sur les entités centrales.** En deçà, l'effet de la liaison automatique ne se voit pas ; au-delà, le bruit devient un problème de lisibilité en démo.

Registres d'alias à mobiliser, par ordre d'intérêt démonstratif :

1. **Titre ou fonction** — « la Régente », « le Second du Val »
2. **Surnom d'usage** — la forme que les gens emploient réellement
3. **Forme courte** — nom sans le patronyme, toponyme abrégé
4. **Variante accentuée ou orthographique** — attestée dans le monde, pas arbitraire
5. **Forme ancienne** — nom d'avant un événement historique, utilisé dans les fiches de la Première Ère

Un alias doit être **plausible dans la prose** : s'il n'apparaît jamais naturellement dans un article, il ne déclenche rien et ne sert à rien.

---

## 5. Cas de démonstration obligatoires

Ce sont eux qui font la différence entre un surlignage trivial et un surlignage impressionnant. Chacun doit être **placé exprès** et **apparaître dans au moins un article**.

| # | Cas | Exigence |
|---|---|---|
| 1 | **Homonyme** | Deux entités de types différents partageant une forme (ex. une cité et la lignée qui la fonda). Le moteur doit trancher, et la fiche doit rendre l'ambiguïté visible |
| 2 | **Sous-chaîne** | Un nom strictement contenu dans un autre. Vérifie la priorité au plus long |
| 3 | **Frontière de mot** | Un nom court apparaissant comme fragment d'un mot commun, qui ne doit **pas** être détecté |
| 4 | **Diacritiques** | Un nom cité tantôt accentué, tantôt non, détecté dans les deux formes |
| 5 | **Casse** | Un alias apparaissant en début de phrase et en milieu de phrase |
| 6 | **Mention manuelle** | 2-3 mentions posées à la main, sur des entités par ailleurs détectables → sert le scénario de recette « le re-scan n'écrase pas MANUAL » |
| 7 | **Densité locale** | Un article contenant au moins 8 entités distinctes détectables, pour la capture d'écran du surlignage |

---

## 6. Topologie du graphe

Le graphe n'a aucune arête saisie à la main : un lien existe uniquement parce qu'un article en cite un autre en prose. **La topologie est donc entièrement décidée à la rédaction.** Ce qui suit n'est pas un objectif souhaitable, c'est une spécification de rédaction.

### 6.1 Forme visée

- **2 nœuds centraux** (~10 liens entrants) — un personnage et une faction.
- **5 à 6 nœuds intermédiaires** (3 à 6 liens).
- **Le reste en périphérie** (1 à 3 liens).
- **Aucun nœud isolé.** Toute entité est citée par au moins un article autre que le sien.
- **Densité cible : 2,5 à 3 liens par entité.** En dessous, le graphe paraît vide ; au-dessus, illisible à 25 nœuds.

### 6.2 Le risque : l'écriture en silos

Un corpus se rédige naturellement par paquets — les lieux d'affilée, puis les organisations, puis le lore. Et en écrivant une ville, on pense spontanément aux autres lieux ; en écrivant une faction, à ses rivales. C'est un réflexe d'écriture, pas une négligence.

Le résultat est un graphe en **amas monochromes** : cinq nœuds bleus reliés entre eux, cinq rouges reliés entre eux, presque rien au milieu. Le moteur a parfaitement fonctionné, mais la vue ne dit que « les lieux vont avec les lieux » — soit exactement ce que la couleur annonçait déjà. L'information est redondante.

Ce que la démonstration doit montrer, c'est l'inverse : que le moteur **découvre des connexions que la taxonomie ne prévoyait pas**. Un artefact relié à une prophétie et à un personnage parce que les trois articles se citent en prose, sans que personne ait rangé ces trois-là ensemble. Là, la couleur porte de l'information.

### 6.3 Règles de rédaction

Elles s'appliquent à chaque article, sans exception.

1. **Règle des deux traversées.** Tout article cite au moins **deux entités appartenant à un groupe autre que le sien**. C'est le garde-fou principal.
2. **Définir par les acteurs, pas par les coordonnées.** Un lieu se décrit par qui l'occupe, le gouverne, le hante et s'y est battu — pas par sa géographie. Un objet, par qui l'a forgé, porté, perdu. Cette règle produit mécaniquement des arêtes traversantes, et donne un meilleur worldbuilding : un lieu défini par ses acteurs est plus vivant qu'un lieu défini par ses reliefs.
3. **Toute conséquence est une arête.** Magie et créatures ne sont jamais décoratives. Une créature qui a vidé une région produit un lieu, une faction née de l'exode, et une légende — trois arêtes, trois groupes.
4. **Citation réciproque proscrite par défaut.** Si A cite B, B ne cite pas nécessairement A : les backlinks font déjà le travail dans l'autre sens, et la réciprocité systématique gaspille du budget de citation qui devrait aller ailleurs.
5. **Budget de citation.** Un article court cite 2 à 4 entités, un article moyen 5 à 8. Au-delà, la prose devient un annuaire et le surlignage un mur de couleur.
6. **Un article de convergence.** Au moins un article moyen cite ≥ 8 entités distinctes issues d'au moins 4 groupes — c'est la fiche destinée à la capture d'écran du surlignage (recoupe le cas 7 du §5).

### 6.4 Plan de citation préalable

La bible (§8, passe 1) se termine par une **matrice de citation** : pour chaque entité, la liste nominative de ce qu'elle citera. Elle se rédige avant toute prose, et c'est là qu'on équilibre le graphe — pas après.

La matrice se vérifie sur trois compteurs :

| Compteur | Seuil |
|---|---|
| Part d'arêtes intra-groupe | **< 50 %** |
| Groupes touchés par chaque groupe | **≥ 3** sur 8 |
| Entités à zéro citation entrante | **0** |

Si un seuil n'est pas tenu, on corrige la matrice — pas les articles déjà écrits. C'est tout l'intérêt de la faire d'abord.

### 6.5 Vérification après génération

Le contrôle se fait sur les relations réellement produites par le worker, pas sur la matrice prévue — l'écart entre les deux est intéressant en soi (il révèle les détections manquées ou surnuméraires). Mêmes seuils qu'en 6.4, plus la densité du 6.1.

---

## 7. Longueur et registre

**Longueur.** 8 entités centrales en format moyen (400-600 mots) ; les 17 autres en format court (150-250 mots). Le surlignage a besoin de matière textuelle, mais un corpus uniformément long est illisible en démonstration.

**Registre.** High fantasy adulte. Intrigue politique, schisme religieux, conflit armé et son coût humain — traités **sobrement, sans complaisance graphique**. Un jury lira ce texte.

La magie et les créatures ne sont pas décoratives : elles ont des **conséquences** sur les sociétés, l'économie et les paysages, et ces conséquences sont ce qui crée les liens entre fiches. Une créature qui a vidé une région produit un lieu, une faction née de l'exode, et une légende — donc trois arêtes de graphe.

**Structure temporelle.** Deux ères et une poignée de dates pivots. Les guerres se situent dans la Première Ère ; le présent narratif est en Seconde Ère, à distance du conflit mais encore façonné par lui. Cette distance justifie les **formes anciennes de noms** (§4, registre 5).

---

## 8. Livraison

Un fichier JSON unique : métadonnées du monde + tableau d'entités conforme au §2. Le script de seed le consomme, il ne contient pas de contenu en dur.

Production en deux passes :
1. **Bible du monde** — géographie, ères, conflits, panthéon, système magique, la table de placement des cas du §5, et **la matrice de citation du §6.4**. Aucune rédaction d'article : la passe 1 se termine sur des seuils vérifiés, pas sur de la prose.
2. **Rédaction des fiches** — à partir de la bible figée.

---

## 9. Critères d'acceptation

- [ ] 25 entités, réparties selon §3, aucune ligature dans les noms et alias
- [ ] Densité d'alias conforme (2-3 en moyenne)
- [ ] Les 7 cas du §5 présents et localisables
- [ ] Matrice de citation produite en fin de passe 1, seuils du §6.4 tenus
- [ ] Aucun nœud isolé après passage du worker
- [ ] Arêtes intra-groupe < 50 % des arêtes totales
- [ ] Chaque groupe touche au moins 3 autres groupes
- [ ] Densité comprise entre 2,5 et 3 liens par entité
- [ ] Un article de convergence (≥ 8 entités, ≥ 4 groupes) identifié pour la capture
- [ ] Le script se rejoue sans créer de doublon
- [ ] Le monde n'est pas décompté du quota
- [ ] Un re-scan n'écrase pas les relations `MANUAL`

---

## 10. Repli

La génération de contenu est chronophage et **n'est pas notée** au Bloc 2. Le cœur (recette TST-*, OWASP, RGAA, dossier) reste prioritaire.

Si la bible n'est pas prête le 20 au soir : **version resserrée à 15 entités**, en conservant intégralement le §5 et le §6. Quinze entités bien liées produisent la même capture d'écran que quarante à moitié rédigées.
