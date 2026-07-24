import { expect, test } from "@playwright/test";

// KAN-17 : recherche basique par nom/alias, scopee au monde courant, filtre
// en direct (debounce). Verifie ici le parcours reel (saisie -> debounce ->
// Server Action -> reaffichage), pas seulement le service en isolation
// (deja couvert unitairement).

test("la recherche filtre les fiches par nom et par alias, insensible a la casse", async ({
  page,
}) => {
  const uniqueEmail = `entity-search-${Date.now()}@story-tide.test`;

  // 1. Inscription + creation d'un monde (meme parcours que les autres e2e).
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Entity Search Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-recherche-1234");
  // Saute le monde d'introduction "Atheraus" (KAN-35), cf. smoke.spec.ts
  // (file de liaison partagee).
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Recherche ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Fiche A : trouvable par son nom.
  const nameA = `Aeliana ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(nameA);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // 3. Fiche B : nom distinct, trouvable seulement par son alias.
  await page.goto(worldUrl);
  const nameB = `Bram ${Date.now()}`;
  const aliasB = `LeTyran${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(nameB);
  await page.getByLabel("Alias (un par ligne)").fill(aliasB);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await page.goto(worldUrl);
  const search = page.getByLabel("Rechercher une entrée");
  // Scope au nav de la sidebar (aria-label "Entrées du monde", sidebar.tsx),
  // SANS passer par getByRole("list") intermediaire : depuis KAN-36 P3, le
  // dashboard affiche AUSSI une liste "Dernières entrées" sur cette meme page
  // (worldUrl) ; depuis le point 5 (groupes pliables), la sidebar elle-meme
  // contient plusieurs <ul> (un par groupe non vide) - getByRole("list") non
  // scope ou meme scope au nav redeviendrait ambigu dans les deux cas
  // (violation "strict mode"). Le nav lui-meme suffit a scoper le lien
  // recherche, c'est la seule chose que ce test verifie reellement.
  const resultsList = page.getByRole("navigation", { name: "Entrées du monde" });

  // 4. Recherche par nom (casse differente) : ne trouve que la fiche A.
  await search.fill(nameA.toUpperCase());
  await expect(resultsList.getByRole("link", { name: new RegExp(nameA) })).toBeVisible();
  await expect(resultsList.getByRole("link", { name: new RegExp(nameB) })).not.toBeVisible();

  // 5. Recherche par alias : ne trouve que la fiche B.
  await search.fill(aliasB);
  await expect(resultsList.getByRole("link", { name: new RegExp(nameB) })).toBeVisible();
  await expect(resultsList.getByRole("link", { name: new RegExp(nameA) })).not.toBeVisible();

  // 6. Recherche sans correspondance : etat vide explicite.
  await search.fill("Zorglub-introuvable");
  await expect(page.getByText("Aucune entité trouvée.")).toBeVisible();

  // 7. Champ vide : reaffiche les deux fiches (liste initiale SSR).
  await search.fill("");
  await expect(resultsList.getByRole("link", { name: new RegExp(nameA) })).toBeVisible();
  await expect(resultsList.getByRole("link", { name: new RegExp(nameB) })).toBeVisible();
});
