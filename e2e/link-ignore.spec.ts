import { expect, test } from "@playwright/test";

// Preuve bout en bout du garde-fou anti-faux-positifs (KAN-23) : "Ignorer ce
// lien" doit a la fois faire disparaitre IMMEDIATEMENT la Relation AUTO
// existante (pas d'attente d'un nouveau scan) et empecher sa recreation tant
// que la cible reste ignoree ; "Ne plus ignorer" doit lever ce garde-fou et
// laisser le PROCHAIN scan la re-detecter (jamais de recreation immediate,
// l'ignore/unignore n'ecrit jamais lui-meme dans Relation).

test("ignorer un lien AUTO le supprime immediatement et bloque sa recreation jusqu'a 'ne plus ignorer'", async ({
  page,
}) => {
  const uniqueEmail = `link-ignore-${Date.now()}@story-tide.test`;

  // 1. Inscription + creation d'un monde (meme parcours que les autres e2e).
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Link Ignore Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-ignore-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Ignore ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Creer l'entite CIBLE.
  const targetName = `Aldric ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(targetName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  const targetMatch = /\/entities\/([^/]+)$/.exec(page.url());
  if (!targetMatch || targetMatch[1] === undefined) {
    throw new Error("id de l'entite cible introuvable dans l'URL");
  }
  const targetId = targetMatch[1];

  // 3. Creer la fiche SOURCE et la faire mentionner la cible (liaison AUTO).
  await page.goto(worldUrl);
  const sourceName = `Chronique ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(sourceName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await page.locator(".ProseMirror").click();
  await page.keyboard.type(`Le roi ${targetName} regne sur ces terres.`);
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // 4. Attendre que le worker ait ecrit la Relation AUTO (poll par rechargements).
  const linkedEntitiesNav = page.getByRole("navigation", { name: "Renvois" });
  await expect(async () => {
    await page.reload();
    await expect(linkedEntitiesNav.getByRole("link", { name: targetName })).toBeVisible();
  }).toPass({ timeout: 20_000 });

  // 5. "Ignorer ce lien" : disparait IMMEDIATEMENT de "Entites liees" (pas
  // d'attente d'un nouveau scan, la Relation AUTO est supprimee tout de suite).
  await linkedEntitiesNav.getByRole("button", { name: "Ignorer ce lien" }).click();
  await expect(page.getByText("Aucune entité liée pour l'instant.")).toBeVisible();

  // 6. Apparait dans "Liens ignores" avec un bouton pour revenir en arriere.
  const ignoredLinksHeading = page.getByRole("heading", { name: "Liens ignorés" });
  await expect(ignoredLinksHeading).toBeVisible();
  await expect(page.getByText(targetName).last()).toBeVisible();
  const unignoreButton = page.getByRole("button", { name: "Ne plus ignorer" });
  await expect(unignoreButton).toBeVisible();

  // 7. "Ne plus ignorer" : la cible sort de "Liens ignores" MAIS ne recree pas
  // la Relation AUTO elle-meme - c'est un garde-fou leve, pas un rescan force.
  await unignoreButton.click();
  await expect(page.getByText("Aucun lien ignoré pour l'instant.")).toBeVisible();
  await expect(page.getByText("Aucune entité liée pour l'instant.")).toBeVisible();

  // 8. Un nouveau passage du worker (declenche par un nouvel autosave) doit
  // re-detecter la cible, la garde-fou n'etant plus actif.
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");
  await page.keyboard.press("Backspace");
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  await expect(async () => {
    await page.reload();
    await expect(linkedEntitiesNav.getByRole("link", { name: targetName })).toBeVisible();
  }).toPass({ timeout: 20_000 });

  // Verifie au passage que le lien pointe toujours vers la bonne cible.
  await linkedEntitiesNav.getByRole("link", { name: targetName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
  expect(page.url()).toContain(`/entities/${targetId}`);
});
