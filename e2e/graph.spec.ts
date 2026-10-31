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
  await page.getByLabel("Mot de passe", { exact: true }).fill("mot-de-passe-graphe-1234");
  // Saute le monde d'introduction "Atheraus" (KAN-35), cf. smoke.spec.ts
  // (file de liaison partagee).
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
  // Apres un goto, le clic peut partir avant l'hydratation et ne jamais
  // ouvrir la modale (flake CI) : clic et ouverture dans le meme retry, cf.
  // link-highlight.spec.ts.
  await expect(async () => {
    if (!(await page.getByLabel("Nom", { exact: true }).isVisible())) {
      await page.getByTestId("create-entity-trigger").click();
    }
    await expect(page.getByLabel("Nom", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Nom", { exact: true }).fill(sourceName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Allie de @");
  await page.keyboard.type(targetName);
  await expect(page.getByRole("option", { name: targetName })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // 4. Visiter le graphe : /graph redirige vers la page du monde (KAN-87).
  await page.goto(`${worldUrl}/graph`);
  await page.waitForURL(worldUrl);

  // 5. Le canvas Cytoscape s'est bien monte (element <canvas> reel, pas
  // seulement le conteneur React).
  const graphCanvas = page.getByTestId("graph-canvas");
  await expect(graphCanvas.locator("canvas").first()).toBeVisible();

  // 5 bis. Clic sur une etoile = carte de selection ; double-clic = fiche
  // (KAN-87). Position lue par le crochet de test (NEXT_PUBLIC_E2E_HOOKS).
  await expect
    .poll(() => page.evaluate(() => window.__storyTideConstellation?.nodes().length ?? 0))
    .toBe(2);
  // Positions a l'ecran stables : la sidebar s'ouvre apres l'hydratation
  // (preference memorisee, transition) et decale le canvas ; un clic lu
  // avant ce decalage tomberait a cote de l'etoile.
  let previous = "";
  await expect
    .poll(async () => {
      const current = await page.evaluate(() =>
        JSON.stringify(
          (window.__storyTideConstellation?.nodes() ?? []).map(({ clientX, clientY }) => [
            Math.round(clientX),
            Math.round(clientY),
          ]),
        ),
      );
      const stable = current === previous;
      previous = current;
      return stable;
    })
    .toBe(true);
  const star = await page.evaluate(
    (label) => window.__storyTideConstellation?.nodes().find((node) => node.label === label),
    targetName,
  );
  if (!star) {
    throw new Error("etoile cible introuvable");
  }
  await page.mouse.click(star.clientX, star.clientY);
  const card = page.getByRole("region", { name: targetName, exact: true });
  await expect(card.getByRole("link", { name: "Ouvrir la fiche", exact: true })).toBeVisible();
  await page.mouse.dblclick(star.clientX, star.clientY);
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
  await page.goto(worldUrl);

  // 5 ter. Total sous le titre et legende du ciel (KAN-85) : la legende est
  // une liste du panneau du menu, HORS du role="menu" (ARIA strict), qui ne
  // contient que les deux actions.
  await expect(page.getByText("2 entrées", { exact: true })).toBeVisible();
  const worldMenu = page.getByRole("menu", { name: "Menu du monde", exact: true });
  // Apres un goto, le clic peut partir avant l'hydratation : clic et
  // ouverture dans le meme retry, sans refermer un menu deja ouvert.
  await expect(async () => {
    if (!(await worldMenu.isVisible())) {
      await page.getByRole("button", { name: "Menu du monde", exact: true }).click();
    }
    await expect(worldMenu).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const legend = page.getByRole("list", { name: "Légende du ciel", exact: true });
  await expect(legend.getByRole("listitem")).toHaveText(["Personnages1", "Lieux1"]);
  await expect(worldMenu.getByRole("menuitem")).toHaveCount(2);
  await expect(worldMenu.getByRole("list")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(worldMenu).toBeHidden();

  // 6. Filtres par type : chips a etat (KAN-36 P5b), pressees par defaut
  // (= type visible), nommees libelle + nombre (KAN-87). Panneau ferme par
  // defaut, ouvert par sa pilule « Filtres ».
  await page.getByRole("button", { name: "Filtres", exact: true }).click();
  const placeFilter = page.getByRole("button", { name: "Lieu · 1", exact: true, pressed: true });
  await placeFilter.click();
  const hiddenPlace = page.getByRole("button", { name: "Lieu · 1", exact: true, pressed: false });
  await expect(hiddenPlace).toBeVisible();
  // Filtre memorise par monde : on le retire avant de lire la liste (la
  // cible est un lieu, elle en disparaitrait).
  await hiddenPlace.click();

  // 7. Liste accessible (chemin clavier/lecteur d'ecran) : reflete la
  // relation MANUAL cree a l'etape 3, navigation reelle verifiee. Panneau
  // « Fils » ferme par defaut, ouvert par sa pilule (KAN-87).
  await page.getByRole("button", { name: "Fils", exact: true }).click();
  const accessibleList = page.getByRole("navigation", {
    name: "Liste des liens de la constellation",
  });
  const targetLink = accessibleList.getByRole("link", { name: `→ ${targetName}` });
  await expect(targetLink).toBeVisible();
  await targetLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
});
