import { expect, test } from "@playwright/test";

// Preuve bout en bout du graphe de relations (KAN-25) : rendu Cytoscape (le
// canvas est une affordance SOURIS, cf. ADR-0012/0010) + liste accessible
// (clavier/lecteur d'ecran, chemin equivalent). La relation est creee via une
// mention manuelle @ (reconciliation SYNCHRONE, ADR-0011) plutot que le scan
// AUTO (asynchrone, worker) - plus rapide et deterministe pour ce test, la
// relation AUTO etant deja couverte par e2e/link-highlight.spec.ts.

test("graphe : rendu Cytoscape + liste accessible + filtres par type", async ({ page }) => {
  const uniqueEmail = `graph-${Date.now()}@story-tide.test`;

  // 1. Inscription + creation d'un monde.
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Graph Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-graphe-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Graphe ${Date.now()}`;
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Creer l'entite CIBLE (type "Lieu", pour exercer un type different).
  const targetName = `Valombre ${Date.now()}`;
  await page.getByLabel("Nom", { exact: true }).fill(targetName);
  const typeCombobox = page.getByRole("combobox", { name: "Type" });
  await typeCombobox.click();
  await typeCombobox.fill("Lieu");
  await page.getByRole("option", { name: "Lieu" }).click();
  await page.getByRole("button", { name: "Créer la fiche" }).click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // 3. Creer la fiche SOURCE (type par defaut "Personnage") et la lier a la
  // cible via une mention manuelle @ (synchrone, pas d'attente de worker).
  await page.goto(worldUrl);
  const sourceName = `Aldric ${Date.now()}`;
  await page.getByLabel("Nom", { exact: true }).fill(sourceName);
  await page.getByRole("button", { name: "Créer la fiche" }).click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Allie de @");
  await page.keyboard.type(targetName);
  await expect(page.getByRole("option", { name: targetName })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // 4. Visiter le graphe.
  await page.goto(`${worldUrl}/graph`);

  // 5. Le canvas Cytoscape s'est bien monte (element <canvas> reel, pas
  // seulement le conteneur React).
  const graphCanvas = page.getByTestId("graph-canvas");
  await expect(graphCanvas.locator("canvas").first()).toBeVisible();

  // 6. Filtres par type : un checkbox par type, coche par defaut.
  const placeFilter = page.getByRole("checkbox", { name: "Lieu" });
  await expect(placeFilter).toBeChecked();
  await placeFilter.click();
  await expect(placeFilter).not.toBeChecked();

  // 7. Liste accessible (chemin clavier/lecteur d'ecran) : reflete la
  // relation MANUAL cree a l'etape 3, navigation reelle verifiee.
  const accessibleList = page.getByRole("navigation", { name: "Graphe (liste accessible)" });
  const targetLink = accessibleList.getByRole("link", { name: `→ ${targetName}` });
  await expect(targetLink).toBeVisible();
  await targetLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
});
