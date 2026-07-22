import { expect, test } from "@playwright/test";
import { Client } from "pg";

// KAN-18 : quotas freemium (3 mondes / 50 entites par monde, sans Stripe).
// Verifie le vrai parcours utilisateur a la frontiere exacte du quota.

test("le quota de mondes bloque la creation au-dela de 3 mondes gratuits", async ({ page }) => {
  const uniqueEmail = `quota-worlds-${Date.now()}@story-tide.test`;

  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Quota Worlds Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-quota-1234");
  // Saute le monde d'introduction "Atheraus" (KAN-35) : ce test ne le
  // concerne pas, et son seed (25 entites + enfilage de jobs) ralentirait/
  // ferait concourir la file de liaison partagee avec les autres jobs e2e.
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  for (let i = 1; i <= 3; i++) {
    await page.getByRole("button", { name: "+ Nouveau monde" }).click();
    await page.getByLabel("Nom du monde").fill(`Monde Quota ${i} ${Date.now()}`);
    await page.getByRole("button", { name: "Créer le monde" }).click();
    await page.waitForURL(/\/worlds\/[^/]+$/);
    await page.goto("/worlds");
  }

  // 4e monde : bloque, reste sur /worlds (pas de redirection).
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(`Monde Quota 4 ${Date.now()}`);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await expect(
    page.getByText("Limite de mondes atteinte pour l'offre gratuite (3 maximum)."),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/worlds");
});

test("le quota d'entites bloque la creation au-dela de 50 fiches gratuites par monde", async ({
  page,
}) => {
  const uniqueEmail = `quota-entities-${Date.now()}@story-tide.test`;

  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Quota Entities Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-quota-5678");
  // Saute le monde d'introduction "Atheraus" (KAN-35) : ce test ne le
  // concerne pas, et son seed (25 entites + enfilage de jobs) ralentirait/
  // ferait concourir la file de liaison partagee avec les autres jobs e2e.
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Entites ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();
  const slugMatch = /\/worlds\/([^/]+)$/.exec(new URL(worldUrl).pathname);
  if (!slugMatch || slugMatch[1] === undefined) {
    throw new Error("slug du monde introuvable dans l'URL");
  }
  const worldSlug = slugMatch[1];

  // Seed direct des 49 premieres fiches (49 creations UI serait lourd et
  // fragile) via pg.Client - meme patron deja etabli dans e2e/global-setup.ts.
  // Les 2 fiches qui comptent (50e et 51e) passent, elles, par la vraie UI.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquant (voir e2e/global-setup.ts).");
  }
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    const { rows } = await db.query<{ id: string }>('SELECT id FROM "World" WHERE slug = $1', [
      worldSlug,
    ]);
    const world = rows[0];
    if (!world) {
      throw new Error("monde introuvable en base pour le seed.");
    }

    for (let i = 0; i < 49; i++) {
      await db.query(
        'INSERT INTO "Entity" (id, "worldId", name, type, content, "plainText", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, now(), now())',
        [`seed-entity-${Date.now()}-${i}`, world.id, `Figurant ${i}`, "character", "{}", ""],
      );
    }
  } finally {
    await db.end();
  }

  // 50e fiche (via UI) : juste sous la limite, doit reussir.
  await page.goto(worldUrl);
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(`Fiche 50 ${Date.now()}`);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  // 51e fiche (via UI) : a la limite, doit etre bloquee.
  await page.goto(worldUrl);
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(`Fiche 51 ${Date.now()}`);
  await page.getByTestId("create-entity-submit").click();
  await expect(
    page.getByText("Limite d'entrées atteinte pour ce monde (offre gratuite : 50 maximum)."),
  ).toBeVisible();
});
