---
name: playwright-reload-topass-click
description: >
  Flake e2e Playwright vu seulement en CI : un clic ou une assertion juste après
  un page.reload() inclus dans un expect(...).toPass(). Déclencheurs : toPass,
  page.reload, flake CI uniquement, clic après reload, hydratation post-reload,
  page pas interactive, retry partiel, link-highlight.spec, link-ignore.spec,
  assertion hors du bloc de retry, jamais reproduit en local, poll par
  rechargements en attendant le worker. Aussi : clic juste après un
  page.goto(), modale qui ne s'ouvre pas, "waiting for getByLabel('Nom')"
  jusqu'au "Test timeout of 120000ms exceeded", create-entity-trigger.
---

# Reload dans un `toPass`, clic derrière : le clic doit être **dans** le retry

## Le symptôme

Un spec passe en local à chaque fois et flake en CI. Le patron : on attend
que le worker ait écrit une Relation AUTO en « pollant par rechargements »
(`expect(async () => { await page.reload(); … }).toPass()`), puis on clique
sur le lien **après** le bloc. Corrigé une première fois sur
`link-highlight.spec.ts`, reproduit à l'identique le lendemain sur
`link-ignore.spec.ts`, qui n'avait pas reçu le durcissement.

## La cause

Quand le `toPass` réussit, la page vient d'être rechargée : rien ne garantit
qu'elle est hydratée et interactive. Le clic suivant part parfois avant, et
seul le retry pourrait le rattraper — mais il est en dehors.

## La solution (patron réel, `e2e/link-ignore.spec.ts`)

```ts
const linkedEntitiesNav = page.getByRole("navigation", { name: "Renvois" });
await expect(async () => {
  await page.reload();
  const link = linkedEntitiesNav.getByRole("link", { name: targetName });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
}).toPass({ timeout: 20_000 });
expect(page.url()).toContain(`/entities/${targetId}`);
```

Visibilité, clic et assertion de navigation dans le **même** bloc : si le clic
tombe sur une page pas prête, le retry recharge et recommence.

## Même piège sans `toPass` : un clic juste après `page.goto()`

Un `goto` est un rechargement complet, avec la même fenêtre avant hydratation.
Vu en CI le 2026-10-18 sur `link-highlight.spec.ts`, étape « retour au monde,
créer la fiche source » :

```
Error: locator.fill: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByLabel('Nom', { exact: true })
```

Le clic sur `create-entity-trigger` **réussit** (aucune erreur sur le clic),
mais la modale ne s'ouvre jamais : le gestionnaire React n'était pas encore
branché. Le même clic une étape plus tôt passe, parce qu'il suit une
navigation côté client (page déjà hydratée). Jamais reproduit en local.

Patron réel (`e2e/link-highlight.spec.ts`) — clic et ouverture dans le même
retry, sans recliquer si la modale est déjà ouverte :

```ts
await page.goto(worldUrl);
await expect(async () => {
  if (!(await page.getByLabel("Nom", { exact: true }).isVisible())) {
    await page.getByTestId("create-entity-trigger").click();
  }
  await expect(page.getByLabel("Nom", { exact: true })).toBeVisible({ timeout: 2_000 });
}).toPass({ timeout: 20_000 });
await page.getByLabel("Nom", { exact: true }).fill(nom);
```

Le garde `isVisible()` est indispensable : le projet n'a pas d'`actionTimeout`,
un second clic sous l'overlay d'une modale déjà ouverte attendrait jusqu'au
timeout du test au lieu d'échouer vite.

## Règle

Dès l'**écriture** d'un test avec reload ou `goto` : tout ce qui dépend de
l'état post-chargement (clic qui ouvre une modale, assertion qui suit) va dans
le `toPass`. Quand un flake de ce type est corrigé sur un spec,
`grep -n "page.reload\|page.goto" e2e/` et durcir les autres dans le même
commit (le 2026-10-18 : sept specs, huit points).
