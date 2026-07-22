---
name: nextjs-props-state-desync
description: Bug « la donnée ne se met pas à jour côté UI » dans Next.js App Router (Server Components, layout partagé, sidebar figée, liste périmée, revalidatePath sans effet). À consulter AVANT de soupçonner le cache serveur. Mots-clés — stale, périmé, sidebar pas à jour, revalidatePath, revalidateTag, useState, props, layout persistant, router refresh.
---

# Donnée UI périmée : chercher le useState(prop) AVANT revalidatePath

**Symptôme signature** : après une mutation, les données de la *page* sont fraîches
(récents, compteurs) mais un élément partagé du *layout* (sidebar, nav) reste figé.
→ La revalidation serveur fonctionne. Le bug est **côté client**.

**Cause type** (BUG-004, prouvée par log le 22/07/2026) : un composant client copie
sa prop dans un state — `useState(initialEntities)` — or l'argument de `useState`
n'est lu qu'au **premier montage**. Dans un layout App Router, le composant
**persiste à travers toutes les navigations internes** : il ne remonte jamais, les
props fraîches arrivent et sont silencieusement ignorées.

**Protocole** :
1. Suivre la chaîne de props jusqu'au composant client ; chercher `useState(<prop>)`,
   `useRef(<prop>)`, `useMemo` sans dépendance.
2. Prouver par log (2 lignes : prop reçue vs state affiché, à chaque rendu) — pas
   par raisonnement. Deux tentatives `revalidatePath` peuvent échouer sans que le
   serveur soit en cause.
3. Correctif : dériver l'affichage des props à chaque rendu ; ne garder en state
   que ce qui doit survivre (requête de recherche, état plié). Si le state porte
   des résultats *serveur* (recherche), le garder — mais l'affichage par défaut
   (requête vide) vient toujours des props.

Piège associé : `revalidatePath(path, "layout")` sous un groupe de routes exige le
groupe dans le patron (`/(app)/worlds/[slug]`) — sinon échec **silencieux**.
