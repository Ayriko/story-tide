import { expect, test } from "@playwright/test";

// KAN-77 : apres l'auto-save, la liste "Renvois" doit afficher la Relation
// origin=AUTO ecrite par le VRAI worker (demarre par e2e/global-setup.ts)
// SANS rechargement, navigation ni frappe supplementaire - l'editeur attend
// scannedVersion >= contentVersion (getEntityScanStatusAction) puis
// re-rend la page. Avant le correctif, le seul router.refresh() partait
// avant le passage du worker : le lien n'apparaissait qu'a la frappe
// suivante ou au rechargement, donc ce test echouait (aucune action ne
// suit l'attente). Risque residuel assume : un worker plus rapide que ce
// premier refresh ferait passer le test meme avec le bug - improbable
// (polling pg-boss ~2 s contre un refresh immediat).
//
// Un seul job enfile : reste dans le projet "chromium" partage (skill
// e2e-jobs-file-partagee - seul un volume de jobs justifie un projet sequence).

test("Renvois se met a jour seul apres le scan du worker", async ({ page }) => {
  const uniqueEmail = `renvois-live-${Date.now()}@story-tide.test`;

  // 1. Inscription + monde (meme parcours que link-highlight.spec.ts), sans
  // le monde d'introduction - ses 25 jobs noieraient celui de ce test.
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Renvois Live Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mot-de-passe-renvois-1234");
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(`Monde Renvois ${Date.now()}`);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Fiche CIBLE, puis fiche SOURCE.
  const targetName = `Ysolde ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(targetName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await page.goto(worldUrl);
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(`Annales ${Date.now()}`);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // 3. Le nom de la cible tape en texte brut (pas une mention @) : seule une
  // Relation AUTO, donc seul le worker, peut le faire apparaitre dans Renvois.
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(`La reine ${targetName} veille.`);
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // 4. Plus aucune action : ni reload, ni goto, ni frappe.
  const renvois = page.getByRole("navigation", { name: "Renvois" });
  await expect(renvois.getByRole("link", { name: targetName })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Mise à jour des liens détectés…")).toBeHidden({ timeout: 20_000 });
});
