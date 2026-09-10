### Session — 2026-09-09 — Incident sécurité poste de travail : rotation des accès VPS, audit d'intégrité du dépôt, traçabilité

**Thèmes abordés :**
- Compromission du poste de travail principal (PC fixe) par un infostealer le 09/09 à 13:25 — périmètre réel de l'exposition et conséquences sur la chaîne de déploiement.
- Relecture complète de la chaîne CI/CD depuis les fichiers réels (`ci.yml`, `cd.yml`) et non depuis la spec, pour établir quels accès touchent effectivement le VPS.
- Inventaire des fichiers `.env` du dépôt et classement par risque réel en cas de fuite (contenu comparé valeur par valeur aux placeholders des `.example`).
- Rotation des accès SSH du VPS (comptes `deploy` et `debian`) et vérification que le déploiement fonctionne après rotation.
- Identification d'un second vecteur, non couvert par la rotation SSH : les identifiants du compte GitHub stockés sur le poste compromis.
- Audit d'intégrité du dépôt local à la recherche de persistance (config git, hooks, fichiers modifiés, tags).

**Décisions prises :**
- **Révoquer l'ancienne clé de déploiement plutôt que la conserver**, alors même qu'aucune intrusion n'a été constatée sur le VPS (journaux d'authentification vérifiés, aucune connexion inconnue, aucune clé étrangère, aucun service/cron/conteneur inattendu). Justification : la clé avait été générée sur le PC fixe le 18/07, sa partie privée résidait donc sur la machine compromise **en plus** du secret GitHub — l'absence de trace d'exploitation ne vaut pas preuve de non-exfiltration. Tranché par Aymeric.
- **Générer la nouvelle paire ed25519 sur le VPS lui-même** (commentaire `github-actions-deploy-2026-09-09`), publique ajoutée à `authorized_keys`, privée déposée dans le secret GitHub `VPS_SSH_KEY` puis effacée du serveur (`shred`). Tranché par Aymeric.
- **Effectuer le transport de la clé privée depuis un autre poste que le PC compromis.** Point soulevé en séance : entre le VPS et le champ de saisie GitHub, la clé transite par un presse-papier et un navigateur — une rotation menée depuis la machine encore infectée aurait re-compromis la nouvelle clé immédiatement. Confirmé par Aymeric : opération réalisée depuis un autre PC.
- **Séparation stricte des clés personnelles et de la clé de déploiement** : les clés personnelles sont retirées de `deploy`, qui n'accepte plus que la clé du CI ; la clé du PC fixe est retirée de `debian`, seule celle du portable subsiste. Tranché par Aymeric.
- **Ne pas rotationner les secrets applicatifs du VPS** (`.env.prod`/`.env.staging`, identifiants PostgreSQL et MinIO, `BETTER_AUTH_SECRET` de production). Justification vérifiée en séance, pas supposée : ces valeurs n'ont jamais existé sur le poste — le `.env` local ne contient qu'un secret de développement pointant sur `localhost` et des placeholders (cf. gotchas).
- **Assumer et documenter explicitement le compromis `deploy` ∈ groupe `docker`** (équivalent root en pratique : montage de `/` dans un conteneur) plutôt que de le passer sous silence dans le dossier Bloc 2. Tranché par Aymeric.
- **Ne pas appliquer la parade `command=` dans `authorized_keys` en séance** : identifiée comme évolution de durcissement, hors du périmètre chaud de la remédiation. Consignée en suite.

**Éléments notables / appris (gotchas) :**
- **Le remote du dépôt est en HTTPS (`https://github.com/Ayriko/story-tide.git`), pas en SSH.** Conséquence directe et contre-intuitive : l'authentification git vers GitHub ne passe pas par `~/.ssh/` mais par le **Gestionnaire d'identifiants Windows**, auxquels s'ajoutent les cookies de session du navigateur et un éventuel token `gh` CLI. Un raisonnement d'incident centré sur « le malware a lu `~/.ssh/` » rate donc le vecteur principal — les infostealers ciblent les magasins d'identifiants et les cookies au moins autant que les clés SSH. La rotation de `VPS_SSH_KEY` seule n'aurait rien fermé de ce côté.
- **Chemin d'attaque complet ouvert par un accès en écriture au dépôt, sans jamais connaître `VPS_SSH_KEY`** : pousser un commit modifiant `.github/workflows/cd.yml`, puis poser un tag annoté `vX.Y.Z-rc.N` dessus. Le workflow s'exécute depuis le commit taggé, l'environment `staging` n'a **aucun reviewer** → déploiement automatique, secret injecté par GitHub, commandes arbitraires sur le VPS sous `deploy` (groupe `docker` ≈ root). **Le gate `production` ne protège pas ce chemin** puisque le suffixe `-rc.` route vers `staging`. La barrière humaine posée en KAN-10 couvre la mise en production, pas la préproduction.
- **Une rotation de clé peut se re-compromettre au transport.** La clé peut être générée dans un environnement sain et redevenir compromise entre-temps, simplement parce que le presse-papier traversé appartient à la machine infectée. Le lieu de génération ne suffit pas : c'est le chemin complet qu'il faut tracer.
- **Aucun secret de production n'était présent sur le poste** — vérifié valeur par valeur, pas supposé : `.env` local = `BETTER_AUTH_SECRET` de développement (64 hex, base `localhost`), clés S3 identiques aux placeholders du `.example`, `SMTP_USER`/`SMTP_PASSWORD` valant littéralement `dev-placeholder` avec `MAIL_TRANSPORT=memory`. Le vrai mot de passe SMTP OVH n'a jamais quitté `deploy/.env.prod` sur le VPS. Conclusion valable même en supposant que le malware a ratissé les fichiers `.env` du disque, ce que ces familles font systématiquement.
- **`.next/standalone/.env` est une copie octet pour octet du `.env`**, produite par le build Next en mode standalone. Ignoré par git (`/.next/`) et par Docker (`.next` dans `.dockerignore`), donc aucun canal de fuite automatique — mais c'est un second exemplaire des secrets de dev dans un dossier qu'on oublie en archivant ou en partageant le projet.
- **Aucun `.env` n'a jamais été ajouté à l'historique git** : `git log --all --diff-filter=A` sur tout l'historique ne remonte rien. Ce n'est pas de la chance mais l'effet des garde-fous posés dès KAN-10 (`.gitignore` : `.env*` + négations explicites pour les quatre `.example` ; `.dockerignore` : `.env`, `.env.*`) — une mesure préventive qui a effectivement payé le jour où elle a servi.
- **Audit d'intégrité du dépôt local : aucune trace de persistance.** `git config --local` propre (pas de `core.sshCommand`, pas de `url.insteadOf`, pas d'alias piégé, `core.hooksPath` = `.husky/_` légitime, remote conforme) ; `.git/hooks/` vide hors samples ; aucun fichier suivi modifié depuis le 08/09 (seuls `coverage/` et `.idea/workspace.xml`, artefacts) ; `git status` propre ; dernier tag `v1.4.0` du 27/08, cohérent. Les vecteurs classiques de persistance dans un dépôt (`core.sshCommand` pointant un binaire malveillant, hook `pre-commit` détourné, remote réécrit par `url.insteadOf`) ont tous été vérifiés nominativement, pas par impression générale.
- **`deploy/traefik/.env.example` est vide** — seul fichier d'environnement d'infra sans placeholder documenté, alors qu'il porte `ACME_EMAIL`. Trou de documentation repéré au passage (C2.4.1), non corrigé cette session.

**Commandes utiles de la session :**
- `git log --all --diff-filter=A --name-only -- '*.env' '*.env.*' ':!*example*'` — prouver qu'aucun fichier d'environnement réel n'a jamais été ajouté à l'historique (l'absence dans le working tree ne dit rien du passé).
- `git config --local --list` — audit de persistance après compromission d'un poste : chercher nommément `core.sshCommand`, `url.*.insteadOf`, `core.hooksPath`, `core.pager` et les alias.
- `find . -path ./node_modules -prune -o -path ./.next -prune -o -type f -newermt "2026-09-08" -print` — lister les fichiers touchés après l'heure de compromission, en excluant les dossiers d'artefacts qui noient le signal.
- `git check-ignore -v <fichier>` — vérifier quelle règle exacte ignore un fichier (et donc qu'un `.env` ne peut pas partir par inadvertance).
- `git ls-remote --tags origin` — comparer les tags du remote aux tags locaux : un tag inconnu = un déploiement déclenché par un tiers.
- `ssh-keygen -lf ~/.ssh/authorized_keys` — lister les empreintes et commentaires des clés réellement autorisées sur un compte, pour confirmer une révocation.
- `shred` sur la clé privée après copie dans le secret GitHub — ne pas laisser la partie privée traîner sur le serveur qui l'a générée.

**Livrables produits :**
- **Sur le VPS** (Aymeric, à la main) : ancienne clé de déploiement révoquée ; nouvelle paire ed25519 `github-actions-deploy-2026-09-09` générée sur le serveur, publique dans `authorized_keys` de `deploy`, privée dans le secret GitHub puis effacée ; clés personnelles retirées de `deploy` ; clé du PC fixe retirée de `debian`.
- **Sur GitHub** (Aymeric) : secret `VPS_SSH_KEY` mis à jour ; sessions, jetons et identifiants du compte traités ; mot de passe changé.
- **Vérification** : workflow de déploiement relancé, étape SSH OK, déploiement fonctionnel.
- `docs/manuels/deploiement.md` : bloc daté « Mise à jour 2026-09-09 » ajouté sous l'état du 18/07, qui reste intact (note additive, jamais de réécriture).
- `docs/securite-owasp.md` : ligne A08 étendue avec l'incident, la chronologie, ce qui a contenu la compromission et la limite assumée du groupe `docker`.
- Cette entrée de dev-log.
- Aucun fichier de `src/` touché : session de remédiation et de documentation, pas de changement fonctionnel — donc pas d'entrée `CHANGELOG.md` (rien de livré à l'utilisateur).

**Avancement certification :**
- **C2.2.3 (sécurité, éliminatoire)** : un incident réel, tracé, avec chronologie, périmètre d'exposition établi par vérification et non par supposition, mesures correctives datées et limite résiduelle assumée. La ligne A08 passe d'une mesure théorique (« le VPS ne build jamais ») à une mesure éprouvée en conditions réelles — même registre que la vérification Shai-Hulud du 04/08 sur A06.
- **C2.2.4 / C2.4.1 (traçabilité)** : état serveur du 18/07 conservé et enrichi d'un bloc daté plutôt que réécrit — l'historique des décisions reste lisible, y compris ce qui s'est révélé insuffisant.
- **Bloc 3 (gestion de projet en solo)** : la séparation `debian`/`deploy` posée le 18/07 est ce qui a contenu l'incident au périmètre du poste de travail. Une décision d'architecture prise deux mois plus tôt, sans incident en vue, dont on peut mesurer l'effet après coup — argument plus fort qu'un dossier sans incident.

**À faire / suite :**
- Après réinstallation du PC fixe : générer une nouvelle clé personnelle et l'ajouter **uniquement** à `debian`, jamais à `deploy`.
- Sur le poste réinstallé : purger l'entrée `git:https://github.com` du Gestionnaire d'identifiants Windows avant de reconfigurer le remote, pour repartir sur un jeton propre.
- Régénérer le `BETTER_AUTH_SECRET` de développement dans le `.env` local et supprimer `.next/` (qui en conserve une copie octet pour octet).
- Évaluer la parade `command="<script de déploiement figé>",no-port-forwarding,no-agent-forwarding,no-pty` dans l'`authorized_keys` de `deploy` : limiterait une future clé CI volée à l'exécution d'un script fixe au lieu d'un shell libre — c'est la vraie réponse à la limite du groupe `docker`.
- Évaluer l'épinglage de la clé d'hôte du VPS (secret `VPS_HOST_KEY` écrit dans `known_hosts`) en remplacement du `ssh-keyscan -H` rejoué à chaque run, qui accepte la clé d'hôte aveuglément (TOFU à chaque exécution).
- Évaluer une restriction sur qui peut pousser des tags, ou un reviewer sur l'environment `staging` : aujourd'hui un accès en écriture au dépôt suffit à obtenir une exécution sur le VPS sans approbation.
- Remplir `deploy/traefik/.env.example` (`ACME_EMAIL`), seul fichier d'infra sans placeholder documenté.
- Reporter cette entrée dans `dev-log.md` (hors dépôt) + redéposer dans le projet Claude.

---

**Décisions techniques**

| 2026-09-09 | **Révoquer la clé de déploiement du 18/07 malgré l'absence de trace d'intrusion sur le VPS** | Conserver la clé et surveiller les journaux, l'exfiltration n'étant pas prouvée | La partie privée résidait sur la machine compromise en plus du secret GitHub ; l'absence de trace d'exploitation ne vaut pas preuve de non-exfiltration — le coût d'une rotation est nul face au risque conservé |
| 2026-09-09 | **Générer la nouvelle paire sur le VPS et la transporter depuis un poste sain** | Générer sur le poste de travail puis pousser la publique | Le lieu de génération ne suffit pas : le presse-papier et le navigateur du transport appartiennent à une machine, une rotation menée depuis le poste infecté aurait re-compromis la clé neuve immédiatement |
| 2026-09-09 | **`deploy` n'accepte plus que la clé du CI ; les clés personnelles passent exclusivement par `debian`** | Garder un accès personnel de secours sur `deploy` pour le dépannage | Séparation stricte des usages : le compte automatisé n'est joignable que par la chaîne automatisée, tout accès humain passe par un compte tracé et distinct — et une clé personnelle compromise n'ouvre plus le compte qui pilote Docker |
| 2026-09-09 | **Assumer et documenter le compromis `deploy` ∈ groupe `docker` (≈ root) plutôt que de le masquer** | Ne pas l'évoquer dans le dossier ; retirer `deploy` du groupe `docker` et passer par `sudo` ciblé | Le déploiement automatisé exige le pilotage de Docker ; la parade réelle est la restriction `command=` dans `authorized_keys`, consignée en évolution — une limite documentée vaut mieux qu'une sécurité déclarée à tort |

**Erreurs rencontrées & Solutions**

| 2026-09-09 | Rotation SSH menée mais périmètre d'exposition sous-évalué : le remote étant en HTTPS, les identifiants GitHub du poste (Gestionnaire d'identifiants Windows, cookies de session, token `gh`) restaient exploitables | Raisonnement d'incident centré sur `~/.ssh/`, alors que le vecteur d'authentification réel vers GitHub n'est pas SSH sur ce dépôt | Révocation de toutes les sessions, des jetons personnels et des applications OAuth ; vérification des clés SSH et deploy keys du compte, de l'historique des runs Actions et des tags du remote ; changement de mot de passe |
| 2026-09-09 | Le gate humain `production` ne couvre pas le chemin `tag -rc → staging`, qui déploie sans approbation | L'environment `staging` est volontairement sans reviewer pour garder la préproduction automatique ; conçu contre l'erreur humaine, pas contre un accès dépôt hostile | Consigné comme évolution : reviewer sur `staging` ou restriction sur la pose de tags ; parade `command=` côté VPS pour borner ce que la clé CI peut exécuter |

*Aucun changement de code cette session — remédiation, audit et documentation uniquement. Les trois fichiers de documentation sont préparés côté dépôt ; commit et push restent à la main d'Aymeric.*
