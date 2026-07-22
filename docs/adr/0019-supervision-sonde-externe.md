# ADR-0019 — Supervision v1 : sonde externe plutôt qu'auto-hébergée

- **Statut** : accepté
- **Date** : 2026-07-22
- **Décideur** : Aymeric (MOE)

## Contexte et problème

C4.1.2 (éliminatoire Bloc 4) exige un dispositif de supervision détectant une
panne applicative (app down, base injoignable) et une sauvegarde
silencieusement en échec. Le VPS est mono-nœud (ADR-0013) : toute solution de
supervision **auto-hébergée sur ce même VPS** partage son sort — si le VPS
tombe (kernel panic, saturation disque, coupure réseau), la solution de
supervision tombe avec lui et ne peut jamais alerter de sa propre panne. Il
faut un point d'observation **externe** au VPS pour couvrir ce cas, sans pour
autant construire une infrastructure de monitoring disproportionnée pour un
projet de cette taille (budget/j-h figés, Bloc 1).

## Options envisagées

**Sonde de disponibilité :**
- **A — Uptime Kuma auto-hébergé** (sur le même VPS, dans un conteneur
  supplémentaire) : gratuit, configurable finement — mais angle mort total si
  le VPS tombe entièrement (le cas le plus grave à détecter) ; charge CPU/RAM
  supplémentaire sur un VPS déjà mono-nœud ; encore une image à maintenir/
  mettre à jour — écartée.
- **B — Netdata auto-hébergé** : métriques riches, mais même angle mort
  structurel qu'Uptime Kuma (auto-hébergé = solidaire du VPS surveillé), et
  disproportionné pour un besoin de supervision simple (statut binaire +
  heartbeat) — écartée.
- **C — UptimeRobot** (sonde externe, offre gratuite) : couvre le besoin
  minimal (ping HTTP périodique, alerte e-mail) mais offre gratuite limitée
  (intervalle 5 min minimum, pas de heartbeat dédié dans le plan gratuit,
  fonctionnalités d'alerte plus restreintes) — écartée au profit de D.
- **D — Better Stack (sonde externe + heartbeat monitors)** : couvre à la
  fois la sonde HTTP périodique (`/api/health`) ET le heartbeat de
  sauvegarde (endpoint dédié qui alerte sur *absence* de ping, pas seulement
  sur ping en échec) dans une seule offre, sans infrastructure à maintenir —
  **retenue**.

**Endpoint interrogé par la sonde :**
- **A — Réutiliser la racine `/`** (déjà le comportement du healthcheck
  Docker avant cette ADR) : ne vérifie que « le process HTTP répond »,
  jamais la connectivité base — un déploiement avec une base cassée derrière
  une app qui répond quand même (page d'erreur générique) resterait invisible
  — écartée.
- **B — Endpoint dédié `/api/health`**, vérifiant explicitement la base
  (`SELECT 1`, timeout 2 s) : détecte le cas réellement dangereux (app up,
  base down) — **retenue**.

## Décision

Supervision v1 repose sur une **sonde externe** (Better Stack) interrogeant
`GET /api/health` (nouvel endpoint, vérifie app + base) sur les deux domaines
publics, complétée par un **heartbeat** du service `backup` après chaque
sauvegarde réussie. Le healthcheck Docker natif de l'app est aligné sur ce
même endpoint (détection locale rapide, utile au CD via `--wait`), mais reste
une couche interne — la couche qui alerte un humain est exclusivement
externe. Voir `docs/supervision.md` pour le détail du dispositif.

## Conséquences

- **Positives** : couvre le cas structurellement le plus grave (VPS
  entièrement down) qu'une solution auto-hébergée ne peut pas couvrir ; zéro
  conteneur/service supplémentaire à maintenir sur le VPS ; le heartbeat de
  sauvegarde détecte un échec **silencieux** (cron arrêté, script qui échoue
  avant même d'écrire un log consulté) sans dépendre d'une lecture manuelle
  des logs.
- **Négatives / dette assumée** : dépendance à un service tiers (Better
  Stack) pour l'alerte — si ce service est indisponible, aucune alerte ne
  part (risque accepté, hors budget/périmètre de construire une redondance
  d'alerte) ; pas de métriques applicatives (p95, taux d'erreur) dans cette
  v1, uniquement un statut binaire — voir feuille de route v2
  (`docs/supervision.md`) ; les seuils (intervalle, nombre d'échecs) sont
  configurés directement dans Better Stack, non versionnés dans ce dépôt.

## Compétence(s) servie(s)

C4.1.2 (supervision — éliminatoire Bloc 4) ; C2.4.1 (traçabilité de la
décision) ; C2.2.3 (sécurité — endpoint public minimal, cf.
`docs/securite-owasp.md` A05/A09).
