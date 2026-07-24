import path from "node:path";
import { expect, test, type Locator } from "@playwright/test";

// KAN-16 : upload d'image depuis l'editeur, vraie fiche MinIO (dev container
// deja up), verifie le round-trip complet : upload -> insertion -> sauvegarde
// -> rechargement -> l'image reste visible via /api/media/[imageId] (URL
// signee resolue a chaque lecture, jamais persistee directement).

const FIXTURE_PATH = path.resolve(__dirname, "fixtures", "test-image.png");

// toBeVisible() ne suffit pas ici : la fixture est un PNG 1x1 (poids minimal),
// et l'extension Image.configure({loading:"lazy"}) (KAN-16) retarde le
// chargement reel tant que l'element n'entre pas dans le viewport - le
// <img> peut donc exister dans le DOM (et etre "visible" au sens CSS) avant
// meme d'avoir fini de charger l'octet reel. La preuve correcte que le
// round-trip /api/media -> URL signee MinIO a reellement fonctionne est
// `naturalWidth > 0` apres chargement complet, pas la seule presence DOM.
async function expectImageLoaded(locator: Locator): Promise<void> {
  // loading="lazy" ne declenche le fetch reel qu'a l'intersection avec le
  // viewport (IntersectionObserver) - scrollIntoViewIfNeeded() la garantit
  // plutot que de dependre du positionnement fortuit de l'element au moment
  // de l'insertion (constate flaky en CI, jamais en local : viewport headless
  // different).
  await locator.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => locator.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      { timeout: 15_000 },
    )
    .toBe(true);
}

test("upload d'image : insertion, sauvegarde, et persistance apres rechargement", async ({
  page,
}) => {
  const uniqueEmail = `image-upload-${Date.now()}@story-tide.test`;

  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Image Upload Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-image-1234");
  // Saute le monde d'introduction "Atheraus" (KAN-35), cf. smoke.spec.ts
  // (file de liaison partagee).
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Image ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);

  const entityName = `Portrait ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(entityName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // Ouvre le dialog "Image" (KAN-39 volet 4 : Dialog shadcn, plus un popover
  // maison), choisit le fichier de fixture, renseigne l'alt, insere.
  await page.getByRole("button", { name: "Image" }).click();
  await page.getByLabel("Importer une image").setInputFiles(FIXTURE_PATH);
  await page.getByLabel("Légende").fill("Portrait de test");
  await page.getByRole("button", { name: "Insérer" }).click();

  // L'image inseree est presente dans l'editeur (vrai <img>, pas juste le
  // node JSON) - src pointe vers /api/media/<imageId>, jamais une URL MinIO
  // directe - et le round-trip /api/media -> URL signee a reellement chargee
  // les octets (naturalWidth > 0, pas seulement une presence DOM).
  const editorImage = page.locator(".ProseMirror img");
  await expect(editorImage).toHaveAttribute("src", /\/api\/media\//);
  await expect(editorImage).toHaveAttribute("alt", "Portrait de test");
  await expectImageLoaded(editorImage);

  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // Rechargement : le contenu (avec la reference image) doit survivre la
  // frontiere RSC -> Client, et l'image doit rester affichable (round-trip
  // /api/media/[imageId] -> URL signee MinIO fraiche).
  await page.reload();
  const reloadedImage = page.locator(".ProseMirror img");
  await expect(reloadedImage).toHaveAttribute("alt", "Portrait de test");
  await expectImageLoaded(reloadedImage);
});
