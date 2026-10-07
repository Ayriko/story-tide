---
name: playwright-reload-topass-click
description: >
  Flake e2e Playwright vu seulement en CI : un clic ou une assertion juste après
  un page.reload() inclus dans un expect(...).toPass(). Déclencheurs : toPass,
  page.reload, flake CI uniquement, clic après reload, hydratation post-reload,
  page pas interactive, retry partiel, link-highlight.spec, link-ignore.spec,
  assertion hors du bloc de retry, jamais reproduit en local, poll par
  rechargements en attendant le worker.
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

## Règle

Dès l'**écriture** d'un test avec reload : tout ce qui dépend de l'état
post-reload va dans le `toPass`. Quand un flake de ce type est corrigé sur un
spec, `grep -n "page.reload" e2e/` et durcir les autres dans le même commit.
