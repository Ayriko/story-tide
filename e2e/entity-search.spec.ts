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
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Recherche ${Date.now()}`;
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Fiche A : trouvable par son nom.
  const nameA = `Aeliana ${Date.now()}`;
  await page.getByLabel("Nom", { exact: true }).fill(nameA);
  await page.getByRole("button", { name: "Créer la fiche" }).click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // 3. Fiche B : nom distinct, trouvable seulement par son alias.
  await page.goto(worldUrl);
  const nameB = `Bram ${Date.now()}`;
  const aliasB = `LeTyran${Date.now()}`;
  await page.getByLabel("Nom", { exact: true }).fill(nameB);
  await page.getByLabel("Alias (un par ligne)").fill(aliasB);
  await page.getByRole("button", { name: "Créer la fiche" }).click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await page.goto(worldUrl);
  const search = page.getByLabel("Rechercher une fiche");
  const resultsList = page.getByRole("list");

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
