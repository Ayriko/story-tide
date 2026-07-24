# Glossaire technique — Story Tide (Blocs 1 & 2)

> Antisèche des termes et acronymes du dossier. Chaque entrée : définition simple + *« chez nous »* quand c'est utile.

---

## 1. Sigles & acronymes

| Sigle | Signification | En clair |
|---|---|---|
| **RNCP** | Répertoire National des Certifications Professionnelles | Le registre officiel des diplômes/titres reconnus par l'État. Notre titre = RNCP39583. |
| **MOA** | Maîtrise d'ouvrage | Le commanditaire : celui qui porte le besoin, le budget, le périmètre. *Chez nous : la direction de Tidemark.* |
| **MOE** | Maîtrise d'œuvre | Celui qui réalise techniquement. *Chez nous : l'équipe technique + moi.* |
| **MVP** | Minimum Viable Product | La première version, resserrée à l'essentiel, qu'on met entre les mains des utilisateurs pour valider le concept. |
| **PO** | Product Owner | Le responsable du « quoi » : il priorise les fonctionnalités et porte la voix de l'utilisateur. |
| **SWOT** | Strengths, Weaknesses, Opportunities, Threats | Tableau d'analyse : Forces / Faiblesses (internes) · Opportunités / Menaces (externes). |
| **MoSCoW** | Must / Should / Could / Won't | Méthode de priorisation : indispensable / important / souhaitable / hors périmètre. |
| **RGPD** | Règlement Général sur la Protection des Données | La loi européenne sur les données personnelles (consentement, droit à l'effacement, etc.). |
| **RGAA** | Référentiel Général d'Amélioration de l'Accessibilité | Les normes officielles françaises pour rendre un site utilisable par les personnes en situation de handicap. |
| **CI/CD** | Continuous Integration / Continuous Deployment | Chaîne automatisée qui teste le code à chaque modification et le met en ligne sans intervention manuelle. |
| **ORM** | Object-Relational Mapping | Une couche qui fait le pont entre le code et la base de données (on manipule des objets, pas du SQL brut). *Chez nous : Prisma.* |
| **API** | Application Programming Interface | Le « contrat » par lequel deux logiciels se parlent. *Ex. : l'API S3 pour le stockage d'images.* |
| **S3** | Simple Storage Service (standard Amazon) | Une façon standard de stocker des fichiers en ligne. *Chez nous : MinIO parle ce standard → remplaçable sans réécrire le code.* |
| **TLS** | Transport Layer Security | Le chiffrement qui sécurise les échanges (le cadenas « https »). |
| **MIME** | type de fichier (Multipurpose Internet Mail Extensions) | L'étiquette qui dit la vraie nature d'un fichier (image, PDF…). *On la vérifie pour la sécurité des téléversements.* |
| **CVE** | Common Vulnerabilities and Exposures | Le système mondial de référencement des failles de sécurité connues. *On suit les CVE de nos dépendances.* |
| **CDN / RSS / SSR** | Content Delivery Network / Really Simple Syndication / Server-Side Rendering | Réseau de diffusion de contenu · flux d'actualités pour la veille · pages générées côté serveur (rapidité, référencement). |
| **JSON** | JavaScript Object Notation | Un format texte structuré pour échanger des données. *Notre éditeur enregistre le texte en JSON → exploitable côté serveur.* |
| **WASM** | WebAssembly | Un format qui fait tourner du code quasi à vitesse native. *Prisma 7 l'utilise → image plus légère.* |
| **j/h** | jour-homme | Unité d'effort : une personne pendant un jour. *Notre première version ≈ 84 j/h.* |
| **SP** | Story points | Unité d'effort relative par tâche ; on les convertit en jours. *168 SP ≈ 84 j/h (1 SP ≈ 0,5 j/h).* |
| **TJM** | Tarif Journalier Moyen | Le coût d'une journée de travail. *Chez nous : ~400 € en interne.* |
| **p95** | 95ᵉ percentile | Mesure de temps de réponse : « 95 % des cas sont sous ce seuil ». *Notre indicateur de la liaison auto.* |
| **RTO / MTTR** | Recovery Time Objective / Mean Time To Repair | Délai cible de remise en service après incident / temps moyen de réparation. |
| **OWASP** | Open Worldwide Application Security Project | Référence des 10 principales failles de sécurité web (surtout Bloc 2). |
| **UML / Merise** | langages de modélisation | Formalismes classiques pour schématiser un logiciel. *On a préféré le modèle C4, plus lisible pour un non-spécialiste.* |
 
---

## 2. Stack & outils techniques

| Terme | En clair | Rôle chez nous |
|---|---|---|
| **TypeScript (TS)** | Le langage JavaScript, mais avec un contrôle des types (moins de bugs). | Un seul langage côté site et côté serveur. |
| **Next.js** | Cadre de développement web complet, basé sur React. | Le squelette de l'application (pages + serveur). |
| **React** | Bibliothèque pour construire des interfaces web. | La base de l'interface. |
| **Tailwind CSS** | Boîte à outils de styles prêts à l'emploi. | La mise en forme visuelle. |
| **PostgreSQL** | Base de données relationnelle robuste et gratuite. | Stocke les données (textes, relations, métadonnées). |
| **Prisma** | Outil (ORM) qui simplifie l'accès à la base de données. | Manipuler la base proprement + migrations. |
| **Drizzle** | Alternative à Prisma. | Surveillé en veille, pas adopté (Prisma reste notre choix). |
| **Docker** | Met chaque brique logicielle dans une « boîte » standardisée (un conteneur). | Environnements reproductibles, faciles à déployer. |
| **Docker Compose** | Orchestre plusieurs conteneurs ensemble. | Lance toute la stack d'une commande. |
| **Traefik** | Aiguilleur d'entrée (reverse-proxy) + gestion automatique du chiffrement. | Reçoit les requêtes, applique le « https », route vers les bons conteneurs. |
| **VPS** | Virtual Private Server : un serveur loué, à nous seuls. | Notre hébergement (un seul, sobre, chez OVH). |
| **OVH / OVHcloud** | Hébergeur français. | Notre fournisseur (données en UE, datacenters bas-carbone). |
| **Hetzner / Vercel** | Hébergeurs concurrents. | Comparés en étude ; Hetzner = plan B documenté. |
| **MinIO** | Serveur de stockage de fichiers auto-hébergé, compatible standard S3. | Stocke les images, hors base de données, sans coût ni verrouillage. |
| **OVH Object Storage** | Stockage de fichiers managé d'OVH (standard S3). | Évolution prévue de MinIO quand le volume grossit. |
| **Tiptap** | Éditeur de texte riche pour le web, gratuit (licence MIT). | Notre éditeur de wiki ; enregistre en JSON exploitable. |
| **ProseMirror** | La fondation technique sous Tiptap (utilisée par NYT, Asana…). | Cœur éprouvé de l'édition de texte. |
| **Lexical / CKEditor 5** | Éditeurs concurrents. | Comparés ; écartés (licence/écosystème). |
| **Leaflet** | Bibliothèque de cartes interactives. | Prévu en phase ultérieure pour les cartes d'univers. |
| **Electron** | Permet d'empaqueter une app web en logiciel de bureau. | Bonus hors périmètre de la première version. |
| **Stripe** | Service d'encaissement de paiements en ligne. | **Différé en évolution P2** — non chiffré au budget de la première version. |
| **Git** | Système de gestion de versions du code. | Historise tout le code, base de la CI/CD. |
| **Claude Team** | Outillage d'IA pour l'équipe (5 sièges). | Coût d'outillage **optionnel**, distinct du coût produit (~1 100 €/an). |
 
---

## 3. Concepts techniques & algorithme

| Terme | En clair |
|---|---|
| **Worldbuilding** | La création d'univers de fiction cohérents (personnages, lieux, objets, histoire). C'est notre domaine. |
| **Wiki** | Un ensemble de pages reliées entre elles, éditables. Le format de base de Story Tide. |
| **Entité** | *(jargon — à l'oral : « élément d'un univers »)* Un personnage, un lieu, un objet… une fiche du wiki. |
| **Graphe de relations** | La carte des liens entre les éléments d'un univers (qui connaît qui, qui est où…). |
| **Liaison automatique / auto-détection** | *(à l'oral : « relier automatiquement les éléments »)* Le cœur différenciant : quand on écrit, le système repère les éléments cités et crée les liens tout seul. |
| **Aho-Corasick** | *(à ne pas nommer brut à l'oral)* Un algorithme qui cherche **plusieurs mots à la fois** dans un texte en **un seul passage**, quel que soit leur nombre. C'est ce qui rend la liaison automatique rapide même quand l'univers grossit. |
| **Automate (de l'algorithme)** | La structure que l'algorithme construit une fois à partir de la liste des éléments, puis réutilise (mise en cache) pour aller vite. |
| **Dictionnaire (d'entités)** | La liste de tous les éléments à détecter dans le texte. Plus l'univers grandit, plus il s'allonge — d'où l'intérêt d'un algorithme qui tient la charge. |
| **LIKE / regex / recherche plein-texte** | Méthodes de recherche classiques en base de données. *Écartées pour la détection : coûteuses ou inadaptées à « baliser toutes les occurrences ».* |
| **Backlink** | Lien inverse : si A cite B, la fiche B montre automatiquement « cité par A ». |
| **User story** | Un besoin exprimé du point de vue de l'utilisateur (« en tant que…, je veux…, afin de… »). Sert à découper et chiffrer le travail. |
| **Sprint / vélocité** | Un cycle de travail court (1-2 semaines) / la quantité de travail que l'équipe abat par sprint (sert à estimer les délais). |
| **Criticité (d'un risque)** | Probabilité × impact. Sert à prioriser les risques (Haute / Moyenne / Basse). |
| **Indexation incrémentale** | On ne recalcule pas tout à chaque ajout : on met à jour seulement ce qui change. *Une des parades à notre risque principal.* |
| **Traitement asynchrone / en arrière-plan** | La tâche lourde (détecter les liens) tourne séparément, sans bloquer l'utilisateur qui écrit. |
| **Cache** | Garder un résultat déjà calculé pour ne pas le refaire. *On met l'automate en cache.* |
| **Scalable / mise à l'échelle** | Capable d'encaisser plus de charge (plus d'utilisateurs/données) sans s'effondrer. |
| **Lock-in (verrouillage fournisseur)** | Dépendance à un prestataire qu'on ne peut plus quitter. *On l'évite : standards ouverts (S3, Docker).* |
| **Greenfield** | Un projet parti de zéro, sans système ancien (legacy) à reprendre. *C'est notre cas.* |
| **Legacy** | Système ou code ancien dont on hérite. *Chez nous : aucun.* |
| **Reverse-proxy** | Un portier qui reçoit toutes les requêtes et les distribue aux bons services. *Chez nous : Traefik.* |
| **Conteneur** | Une « boîte » qui embarque une brique logicielle et tout ce qu'il lui faut pour tourner partout pareil. |
| **Healthcheck** | Vérification automatique qu'un service est bien vivant ; sinon, redémarrage. |
| **URL signée** | Un lien temporaire et sécurisé vers un fichier privé (expire, non devinable). *Pour protéger les contenus privés.* |
| **Lazy-load** | Charger les images seulement quand on en a besoin (au défilement). *Sobriété + rapidité.* |
| **WebP / AVIF** | Formats d'image modernes, plus légers que JPEG/PNG. *Moins de bande passante et de stockage.* |
| **Freemium** | Modèle économique : une version gratuite (avec limites) + une version payante. *Notre mise en marché.* |
| **Patreon** | Plateforme de financement par abonnement, courante dans la niche. *Référence du modèle économique du secteur.* |
| **Full-stack** | Qui couvre à la fois le site (front) et le serveur (back). |
| **Modèle C4** | Une façon de schématiser une architecture par niveaux de zoom (Contexte, Conteneurs, Composants, Code). *On présente le niveau « Conteneurs » — lisible par un non-spécialiste.* |
 
---

## 4. Sobriété & impact environnemental

| Terme | En clair |
|---|---|
| **gCO₂/kWh** | Grammes de CO₂ émis par kilowattheure d'électricité. Mesure le « carbone » de l'énergie. *FR ~20 vs ~175 en moyenne UE → ≈ 9× moins.* |
| **Bilan carbone** | Estimation des émissions de gaz à effet de serre d'une solution. |
| **Water-cooling (refroidissement à eau)** | Refroidir les serveurs avec de l'eau plutôt que la climatisation. *OVH : −50 % d'élec. de refroidissement, −30 % d'eau.* |
| **Datacenter bas-carbone** | Centre de données alimenté par une électricité peu émettrice (cas de la France). |
 
---

## 5. Termes du développement — Bloc 2 (ajoutés le 2026-07-03)

### 5.1 Sigles & acronymes

| Sigle | Signification | En clair |
|---|---|---|
| **ADR** | Architecture Decision Record | Un petit document par décision d'architecture : contexte, options, décision, conséquences. *Chez nous : `/docs/adr/`, matière directe pour C2.4.1 et la parade « solo » du Bloc 3.* |
| **SemVer** | Semantic Versioning (X.Y.Z) | Numérotation des versions : X = rupture, Y = fonctionnalité, Z = correctif. *Suffixe `-rc.N` (release candidate) = version candidate testée en staging avant la prod.* |
| **SLA** | Service Level Agreement | Engagement de délai/qualité. *Chez nous : délais de correction des bogues — P0 < 24 h · P1 < 72 h · P2 planifié.* |
| **WCAG** | Web Content Accessibility Guidelines | Les recommandations internationales d'accessibilité (W3C). *Le RGAA en est la déclinaison légale française — notre référentiel choisi.* |
| **RSC** | React Server Components | Composants React rendus côté serveur, qui peuvent lire la base directement (sans appel HTTP intermédiaire). *Un des arguments du choix full Next.js.* |
| **E2E** | End-to-End (test de bout en bout) | Test qui rejoue un parcours utilisateur complet dans un vrai navigateur. *Chez nous : quelques tests « smoke » avec Playwright.* |
| **CRUD** | Create, Read, Update, Delete | Les 4 opérations de base sur une donnée. *Le socle de la gestion des fiches.* |
| **DoD** | Definition of Done | La liste des conditions pour déclarer une tâche terminée. *Chez nous : code + tests + autorisation vérifiée + accessibilité + entrée au cahier de recettes + docs à jour.* |

### 5.2 Stack & outillage (nouveautés Bloc 2)

| Terme | En clair | Rôle chez nous |
|---|---|---|
| **Better Auth** | Bibliothèque d'authentification TypeScript, pensée pour l'auto-hébergement. | Inscription/connexion email + mot de passe, **sessions stockées en base** (révocables), branchée sur Prisma. |
| **pg-boss** | File de jobs qui vit **dans PostgreSQL** (pas de serveur en plus). | Porte les tâches asynchrones du moteur de liaison ; garanties de la base (ACID), « singleton keys » = un seul job en attente par fiche. |
| **BullMQ / Redis** | File de jobs standard de l'écosystème Node + sa base mémoire. | **Écartés au MVP** (composant en plus sans besoin identifié) ; migration possible en réécrivant le seul adaptateur = point d'extension documenté. |
| **Zod** | Bibliothèque de validation de données TypeScript. | Vérifie **toute** entrée externe (formulaires, uploads, variables d'env) à l'exécution — parade Injection (OWASP A03). |
| **Server Actions** | Mécanisme Next.js : le formulaire appelle directement une fonction serveur typée. | Notre « API » interne — pas de couche HTTP à contractualiser (d'où l'abandon de tRPC). |
| **Vitest** | Lanceur de tests unitaires moderne (écosystème Vite). | Le harnais C2.2.2 ; seuil de couverture **bloquant** en CI (≥ 80 % sur le cœur). |
| **Testing Library** | Outillage de test des composants « comme un utilisateur ». | Teste les formulaires et composants clés par leur rendu, pas leur implémentation. |
| **Playwright** | Pilote un vrai navigateur pour les tests de bout en bout. | 3-5 parcours « smoke » + exécution de l'audit axe-core. |
| **axe-core** | Moteur d'audit d'accessibilité automatisable. | Contrôle RGAA/WCAG automatique dans la CI. |
| **Ara** | L'outil d'audit RGAA **officiel** de l'État français. | Audit manuel tracé avant le rendu — preuve « référentiel présenté et justifié » (C2.2.3). |
| **NVDA** | Lecteur d'écran gratuit (Windows). | Vérification manuelle des parcours clés au lecteur d'écran. |
| **Lighthouse** | Audit intégré à Chrome (perf, accessibilité, bonnes pratiques). | Passes manuelles tracées en complément d'axe-core. |
| **ESLint / Prettier** | Analyse statique du code / formatage automatique. | Lint **bloquant à 0 avertissement** sur toute PR ; style homogène. |
| **Husky** | Déclenche des vérifications au moment du commit (hooks Git). | Filet local : lint + typecheck avant chaque commit, avant même la CI. |
| **ghcr.io** | Le registre d'images Docker de GitHub. | Stocke nos images construites par la CI ; le VPS ne fait que les télécharger. |
| **Cytoscape.js** | Bibliothèque de visualisation de graphes. | Affiche le graphe de relations (zoom, filtres par type, navigation cliquable). |
| **TanStack Query** | Gestion de l'état serveur côté client (cache, resynchronisation). | **Surveillé pour après le S30** : auto-save de l'éditeur, graphe, mises à jour optimistes. |

### 5.3 Concepts (nouveautés Bloc 2)

| Terme | En clair |
|---|---|
| **Ports & adapters (architecture hexagonale)** | Le code métier dépend d'**interfaces** (« ports ») ; les technos concrètes (pg-boss, MinIO) vivent dans des **adaptateurs** interchangeables. *Chez nous : `JobQueue` et `Storage` — migrer de techno = réécrire l'adaptateur, pas le métier.* |
| **Staging / préproduction** | Copie de la production où l'on **recette** avant de déployer pour de vrai. *Chez nous : 2ᵉ stack sur le même VPS, sous-domaine dédié, images `-rc`, données de test.* |
| **Seed (données de démonstration)** | Jeu de données injecté automatiquement : compte démo + un monde peuplé (entités, alias, liens visibles). *Notre « kit jury ».* |
| **Debounce** | Attendre une courte pause dans l'activité avant d'agir. *On ne relance pas la détection de liens à chaque frappe, mais après une pause d'écriture.* |
| **Worker** | Un process séparé qui traite les tâches de fond sans bloquer le site. *Chez nous : le conteneur qui exécute le moteur de liaison.* |
| **Couverture de tests** | Le pourcentage du code traversé par les tests. *Critère C2.2.2 (« la majorité du code ») → seuil bloquant en CI, rapport publié en preuve.* |
| **Cahier de recettes / TST-XXX-NNN** | Le catalogue des scénarios de test fonctionnels : `TST-AUT-001` (authentification), `TST-LNK-…` (liaison), `TST-SEC-…` (sécurité)… chacun avec préconditions, étapes, résultat attendu, critères d'acceptation. *Livrable éliminatoire C2.3.1, dérivé des user stories du Bloc 1.* |
| **Test de non-régression** | Test ajouté avec chaque correctif pour garantir que le bogue ne reviendra pas. |
| **Conventional Commits** | Convention de messages Git (`feat:`, `fix:`, `docs:`…) qui rend l'historique lisible et exploitable. |
| **Keep a Changelog** | Format standard du journal des versions : rubriques Ajouté / Modifié / Corrigé / Supprimé, par version datée. |
| **Tag annoté** | Un marqueur Git posé sur une version précise (`v1.2.0`) : fige l'état du code, base des livraisons reproductibles. |
| **Rate limiting** | Limiter le nombre de tentatives/requêtes par utilisateur ou IP. *Parade force brute sur la connexion (OWASP A04/A07).* |
| **CSP / headers de sécurité** | Instructions envoyées au navigateur pour restreindre ce que la page a le droit de charger/exécuter. *Parade Security Misconfiguration (A05).* |
| **Magic bytes (validation MIME réelle)** | Vérifier la **vraie** signature binaire d'un fichier uploadé, pas juste son extension. *Parade uploads malveillants (A10).* |
| **Alias (d'entité)** | Les autres noms d'un élément d'univers (surnom, titre : « Kael » = « le Marcheur de Marée »). *Dans le schéma dès la v1 : le moteur de liaison les détecte au même titre que le nom.* |
| **Homonymes / occurrence ambiguë** | Deux entités portant le même nom : le moteur ne tranche pas en silence, il marque l'occurrence « ambiguë » et laisse l'utilisateur choisir. |
| **Break-even (seuil de rentabilité)** | Le nombre d'abonnés à partir duquel les revenus couvrent les coûts. *Modèle paramétrable à construire (retour jury Bloc 1).* |

### 5.4 Compléments — moteur, sécurité, UI (ajoutés le 2026-07-24)

| Terme | En clair |
|---|---|
| **Trie (arbre de préfixes)** | Un arbre où chaque chemin épelle un mot ; les mots qui partagent un début partagent une branche. *Phase 1 de la construction de l'automate Aho-Corasick.* |
| **Lien d'échec (failure link)** | Raccourci de l'automate : quand un caractère ne prolonge plus le mot en cours, il fait « retomber » sur le plus long autre mot encore possible, sans jamais revenir en arrière dans le texte. *C'est ce qui garantit le passage unique.* |
| **Normalisation Unicode (NFC / NFD)** | Deux façons d'encoder un caractère accentué (« é » d'un bloc = NFC ; « e » + accent séparé = NFD). *On normalise en NFC à la frontière applicative pour que la détection reste fiable quel que soit le copier-coller (ADR-0020).* |
| **scrypt** | Fonction de hachage de mots de passe, lente par conception (résiste au forçage). *Utilisée par Better Auth : la base ne stocke jamais le mot de passe en clair (OWASP A02).* |
| **HSTS** | En-tête qui force le navigateur à n'utiliser que le HTTPS pour le site. *Appliqué par Traefik (A02/A05).* |
| **SSRF (Server-Side Request Forgery)** | Pousser le serveur à requêter une URL non maîtrisée. *Écarté chez nous : aucune URL utilisateur n'est fetchée, l'hôte du proxy image vient de la configuration serveur (A10, ADR-0023).* |
| **shadcn/ui · Radix** | Composants d'interface accessibles : Radix fournit le comportement (clavier, focus, ARIA), shadcn le style. *Vendored dans le code (ADR-0018), base de la passe visuelle navy/mint.* |
| **jsdom** | Simulateur de navigateur en mémoire pour les tests. *Environnement de Vitest ; ses limites justifient de tester certains rendus via Playwright plutôt qu'en unitaire.* |
| **Constellation** | Notre nom de la vue graphe des relations d'un univers (rendue par Cytoscape). |
| **Standalone (sortie Next.js)** | Mode de build qui n'embarque que le serveur et ses dépendances utiles → image Docker plus légère (sobriété). |