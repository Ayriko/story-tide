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
  // Saute le monde d'introduction "Atheraus" (KAN-35) : ce test ne le
  // concerne pas, et son seed (25 entites + enfilage de jobs) ralentirait/
  // ferait concourir la file de liaison partagee avec les autres jobs e2e.
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Graphe ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Creer l'entite CIBLE (type "Lieu", pour exercer un type different).
  const targetName = `Valombre ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(targetName);
  const typeCombobox = page.getByRole("combobox", { name: "Type" });
  await typeCombobox.click();
  await typeCombobox.fill("Lieu");
  await page.getByRole("option", { name: "Lieu" }).click();
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // 3. Creer la fiche SOURCE (type par defaut "Personnage") et la lier a la
  // cible via une mention manuelle @ (synchrone, pas d'attente de worker).
  await page.goto(worldUrl);
  const sourceName = `Aldric ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(sourceName);
  await page.getByTestId("create-entity-submit").click();
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

  // 6. Filtres par type : chips a etat (KAN-36 P5b), pressees par defaut
  // (= type visible). Panneau FERME par defaut (retour Aymeric) - ouverture
  // explicite requise avant d'atteindre les chips.
  await page.getByRole("button", { name: "Filtres" }).click();
  // exact:true necessaire - "Lieu" matcherait sinon aussi le bouton de repli
  // du groupe "Lieux" de la sidebar (nom accessible different mais englobant).
  const placeFilter = page.getByRole("button", { name: "Lieu", exact: true, pressed: true });
  await placeFilter.click();
  await expect(
    page.getByRole("button", { name: "Lieu", exact: true, pressed: false }),
  ).toBeVisible();

  // 7. Liste accessible (chemin clavier/lecteur d'ecran) : reflete la
  // relation MANUAL cree a l'etape 3, navigation reelle verifiee. Masquee
  // derriere un disclosure FERME par defaut (retour Aymeric) - ouverture
  // explicite requise.
  await page.getByRole("button", { name: "Observer les fils" }).click();
  const accessibleList = page.getByRole("navigation", {
    name: "Liste des liens de la constellation",
  });
  const targetLink = accessibleList.getByRole("link", { name: `→ ${targetName}` });
  await expect(targetLink).toBeVisible();
  await targetLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
});
