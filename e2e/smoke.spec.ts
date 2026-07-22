import { expect, test } from "@playwright/test";

// Parcours unique mais volontairement complet : login -> monde -> fiche ->
// editeur -> reload. Motivation (spec §14) : trois classes de bugs vecues
// (12-14/07) invisibles a un script tsx/curl, attrapees ici par un vrai
// navigateur :
//   1) React StrictMode (dev) : montage/demontage/remontage de l'editeur -
//      les commandes liees au schema (titre/listes/citation/lien/image)
//      cassaient au remontage si les extensions Tiptap etaient partagees.
//   2) Serialisation Next.js Flight : le contenu Tiptap doit survivre au
//      passage RSC (page serveur) -> Client Component (EntityEditor) sans
//      perte, prouve ici par le reload qui relit le contenu sauvegarde.
//   3) Tailwind Preflight : neutralise silencieusement le style natif des
//      titres/listes/citations - exerce ici (pas asserte par pixel/CSS,
//      trop fragile ; l'assertion fine reste pour l'audit axe pleine page).

const CONTENT_TEXT = "Aeliana regne sur les terres du Nord.";

test("login -> monde -> fiche -> editeur -> reload", async ({ page }) => {
  const uniqueEmail = `smoke-${Date.now()}@story-tide.test`;

  // 1. Inscription = auto-login (registerAction pose la session via le
  // plugin nextCookies de Better Auth, puis redirect("/") -> "/worlds").
  await page.goto("/register");
  // exact: true - "Nom" est un libelle court reutilise ailleurs sur la page
  // (ex. "Renommer" le contient comme sous-chaine) ; getByLabel matche par
  // defaut en sous-chaine, pas en nom accessible exact.
  await page.getByLabel("Nom", { exact: true }).fill("Smoke Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-smoke-1234");
  // Saute le monde d'introduction "Atheraus" (KAN-35) : ce test ne le
  // concerne pas, et son seed (25 entites + enfilage de jobs) ralentirait/
  // ferait concourir la file de liaison partagee avec les autres jobs e2e.
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  // 2. Creer un monde (KAN-36 P2 : le formulaire vit dans un Dialog, ouvert
  // par le bouton "+ Nouveau monde").
  const worldName = `Monde Smoke ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(worldName);

  // 3. Creer une entree (type par defaut : Personnage) - Dialog ouvert par
  // le bouton "+ Nouvelle entree" (data-testid create-entity-trigger, bas de la sidebar).
  const entityName = `Aeliana ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  // exact: true - "Nom" est un libelle court reutilise ailleurs sur la page
  // (getByLabel matche par defaut en sous-chaine, pas en nom accessible exact).
  await page.getByLabel("Nom", { exact: true }).fill(entityName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // 4. Editeur : ecrire, selectionner, mettre en gras - verifie la synchro
  // toolbar (useEditorState) survit au remontage StrictMode.
  const editorContent = page.locator(".ProseMirror");
  await editorContent.click();
  await page.keyboard.type(CONTENT_TEXT);
  const selectAll = process.platform === "darwin" ? "Meta+A" : "Control+A";
  await page.keyboard.press(selectAll);

  const toolbar = page.getByRole("toolbar", { name: "Mise en forme" });
  const boldButton = toolbar.getByRole("button", { name: "Gras" });
  await boldButton.click();
  await expect(boldButton).toHaveAttribute("aria-pressed", "true");

  // 5. Autosave (debounce 1,5s + Server Action).
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // 6. Reload : le contenu doit survivre a la frontiere RSC -> Client
  // (parseContent cote serveur, puis EntityEditor recoit initialContent en prop).
  await page.reload();
  await expect(page.locator(".ProseMirror")).toContainText(CONTENT_TEXT);
});
