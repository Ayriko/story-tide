import { expect, test } from "@playwright/test";

/**
 * Non-regression (KAN-85) : la bande de la fleche « Aller au pied de page »
 * (ScrollHint, sticky sur toute la largeur, bottom-3) recouvrait le dernier
 * controle de la Constellation, pose au meme niveau : un vrai clic sur
 * « Reorganiser automatiquement » n'ouvrait rien. Verification sans l'aide au
 * clic de Playwright (qui fait defiler une cible masquee pour l'atteindre) :
 * l'element reellement sous le centre du bouton, puis un clic souris a cet
 * endroit.
 */

const MOT_DE_PASSE = "mot-de-passe-controles-1234";

test("« Reorganiser automatiquement » n'est recouvert par rien", async ({ page }) => {
  const suffixe = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill(`controles ${suffixe}`);
  await page.getByLabel("E-mail", { exact: true }).fill(`controles-${suffixe}@example.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await page.waitForURL("**/worlds");
  await page.getByRole("button", { name: "+ Nouveau monde", exact: true }).click();
  await page.getByLabel("Nom du monde", { exact: true }).fill(`Monde controles ${suffixe}`);
  await page.getByRole("button", { name: "Créer le monde", exact: true }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  await page.waitForLoadState("networkidle");

  const bouton = page.getByRole("button", { name: "Réorganiser automatiquement", exact: true });
  await expect(bouton).toBeVisible();
  const boite = await bouton.boundingBox();
  if (!boite) {
    throw new Error("bouton invisible");
  }
  const centre = { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 };
  const sousLePointeur = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"),
    centre,
  );
  expect(sousLePointeur).toBe("Réorganiser automatiquement");

  await page.mouse.click(centre.x, centre.y);
  await expect(
    page.getByRole("alertdialog", { name: "Réorganiser la Constellation ?", exact: true }),
  ).toBeVisible();
});
