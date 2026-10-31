import { expect, test } from "@playwright/test";

/**
 * Non-regression a11y (KAN-85) : la sidebar repliee restait atteignable au
 * clavier (colonne de largeur nulle, mais ses liens dans l'ordre de
 * tabulation) - sur un monde de 300 entrees, plus de 60 Tab avant le ciel.
 * Repliee, elle est `inert` (colonne) ou retiree (page du monde) : depuis le
 * haut de la page, quelques Tab suffisent pour atteindre le ciel, quel que
 * soit le nombre d'entrees.
 */

const MOT_DE_PASSE = "mot-de-passe-sidebar-1234";
const ENTREES = 12;

test.use({ storageState: { cookies: [], origins: [] } });

test("sidebar repliee : quelques Tab suffisent pour atteindre le ciel", async ({ page }) => {
  const suffixe = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill(`sidebar ${suffixe}`);
  await page.getByLabel("E-mail", { exact: true }).fill(`sidebar-${suffixe}@example.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await page.waitForURL("**/worlds");
  await page.getByRole("button", { name: "+ Nouveau monde", exact: true }).click();
  await page.getByLabel("Nom du monde", { exact: true }).fill(`Monde sidebar ${suffixe}`);
  await page.getByRole("button", { name: "Créer le monde", exact: true }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // Assez d'entrees pour que leurs liens, s'ils etaient atteignables,
  // depassent largement le budget de Tab ci-dessous.
  for (let i = 0; i < ENTREES; i += 1) {
    await page.goto(worldUrl);
    await expect(async () => {
      if (!(await page.getByLabel("Nom", { exact: true }).isVisible())) {
        await page.getByTestId("dashboard-create-entity-trigger").click();
      }
      await expect(page.getByLabel("Nom", { exact: true })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByLabel("Nom", { exact: true }).fill(`Entree ${i} ${suffixe}`);
    await page.getByTestId("create-entity-submit").click();
    await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  }

  await page.goto(worldUrl);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("button", { name: "Afficher la liste des entrées", exact: true }),
  ).toBeVisible();
  const ciel = page.getByRole("group", { name: /^Constellation\./ });

  let tabs = 0;
  while (tabs < 10 && !(await ciel.evaluate((el) => el === document.activeElement))) {
    await page.keyboard.press("Tab");
    tabs += 1;
  }
  await expect(ciel).toBeFocused();
  expect(tabs).toBeLessThan(10);
});

test("replier la sidebar rend le focus au bouton qui la deplie", async ({ page }) => {
  const suffixe = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill(`sidebar2 ${suffixe}`);
  await page.getByLabel("E-mail", { exact: true }).fill(`sidebar2-${suffixe}@example.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await page.waitForURL("**/worlds");
  await page.getByRole("button", { name: "+ Nouveau monde", exact: true }).click();
  await page.getByLabel("Nom du monde", { exact: true }).fill(`Monde sidebar2 ${suffixe}`);
  await page.getByRole("button", { name: "Créer le monde", exact: true }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Afficher la liste des entrées", exact: true }).click();
  const recherche = page.getByRole("navigation", { name: "Entrées du monde", exact: true });
  await expect(recherche).toBeVisible();
  // Focus dans la sidebar, puis Ctrl+B la replie.
  await recherche.locator("input, a, button").first().focus();
  await page.keyboard.press("Control+b");
  await expect(
    page.getByRole("button", { name: "Afficher la liste des entrées", exact: true }),
  ).toBeFocused();
});
