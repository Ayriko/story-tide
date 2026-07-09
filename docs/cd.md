# Protocole de déploiement continu (CD) — C2.1.1

> À rédiger au montage du pipeline de déploiement (GitHub Actions → ghcr.io → pull VPS via SSH).

## Chaîne cible
<!-- TODO : schéma build → push image ghcr.io → trigger SSH → pull & run via Compose sur VPS -->

## Environnements
<!-- TODO : staging (`-rc`) puis prod ; rôle de Traefik (reverse-proxy + TLS) -->

## Déclenchement & rollback
<!-- TODO : événement déclencheur (tag/`main`) ; procédure de retour arrière (image précédente) -->

## Preuves pour le jury
<!-- TODO : extrait de workflow, logs de déploiement, capture staging + prod en ligne -->
