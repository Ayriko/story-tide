import { expect, test, type Page } from "@playwright/test";

/**
 * Parametres du monde - types d'entrees (KAN-81, ADR-0030) : type
 * personnalise visible partout, natif masque, suppression avec
 * reaffectation, suppression d'un monde portant des entrees de type
 * personnalise (FK NO ACTION).
 *
 * Chaque compte s'inscrit SANS monde d'exemple : seules une ou deux entrees
 * vides par test, aucune pression sur la file de liaison partagee (cf. skill
 * e2e-jobs-file-partagee).
 */

const MOT_DE_PASSE = "mot-de-passe-types-1234";

async function inscrireEtCreerMonde(page: Page, prefixe: string): Promise<string> {
  const suffixe = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill(`${prefixe} ${suffixe}`);
  await page.getByLabel("E-mail", { exact: true }).fill(`${prefixe}-${suffixe}@example.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await page.waitForURL("**/worlds");

  await page.getByRole("button", { name: "+ Nouveau monde", exact: true }).click();
  await page.getByLabel("Nom du monde", { exact: true }).fill(`Monde ${prefixe} ${suffixe}`);
  await page.getByRole("button", { name: "Créer le monde", exact: true }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  return page.url();
}

// Apres un goto, le clic peut partir avant l'hydratation et ne jamais ouvrir
// la modale : clic et ouverture dans le meme retry (cf. graph.spec.ts).
async function creerEntree(page: Page, worldUrl: string, nom: string, optionType: string) {
  await page.goto(worldUrl);
  await expect(async () => {
    if (!(await page.getByLabel("Nom", { exact: true }).isVisible())) {
      await page.getByTestId("create-entity-trigger").click();
    }
    await expect(page.getByLabel("Nom", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  const combobox = page.getByRole("combobox", { name: "Type", exact: true });
  await combobox.click();
  await combobox.fill(optionType.replace(" (type personnalisé)", ""));
  await page.getByRole("option", { name: optionType, exact: true }).click();
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  return page.url();
}

async function creerTypePerso(page: Page, worldUrl: string, libelle: string, groupe: string) {
  await page.goto(`${worldUrl}/settings/types`);
  await expect(async () => {
    if (!(await page.getByLabel("Libellé", { exact: true }).isVisible())) {
      await page.getByRole("button", { name: "Nouveau type", exact: true }).click();
    }
    await expect(page.getByLabel("Libellé", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Libellé", { exact: true }).fill(libelle);
  await page.getByLabel("Groupe", { exact: true }).selectOption(groupe);
  await page.getByRole("button", { name: "Créer le type", exact: true }).click();
  const section = page.getByRole("region", { name: "Types personnalisés", exact: true });
  await expect(section.getByText(libelle, { exact: true })).toBeVisible();
}

function badgeDeType(page: Page, libelle: string) {
  return page.getByRole("main").getByText(libelle, { exact: true });
}

test("un type personnalise se cree, s'utilise et apparait dans la sidebar et le filtre de la Constellation", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "types-creer");
  await creerTypePerso(page, worldUrl, "Vaisseau", "Objets");

  const nom = `Aube Grise ${Date.now()}`;
  await creerEntree(page, worldUrl, nom, "Vaisseau (type personnalisé)");
  await expect(badgeDeType(page, "Vaisseau")).toBeVisible();

  const sidebar = page.getByRole("navigation", { name: "Entrées du monde", exact: true });
  await expect(sidebar.getByRole("button", { name: "Objets", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: `${nom} Vaisseau`, exact: true })).toBeVisible();

  await page.goto(`${worldUrl}/graph`);
  await page.getByRole("button", { name: "Filtres", exact: true }).click();
  await expect(page.getByRole("button", { name: "Vaisseau", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("un type natif masque disparait du choix a la creation, ses entrees existantes le gardent", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "types-masquer");
  const entreeUrl = await creerEntree(page, worldUrl, `Les Sept Sceaux ${Date.now()}`, "Prophétie");

  await page.goto(`${worldUrl}/settings/types`);
  // UN seul clic, jamais dans une boucle de retry : une boucle avait masque
  // le bug « bascule au second clic » (case controlee reinitialisee par React
  // 19). L'etat doit tenir apres rechargement (verite serveur).
  const toggle = page.getByRole("switch", { name: "Proposer le type Prophétie", exact: true });
  await expect(toggle).toBeChecked();
  // Hydratation terminee avant le clic unique (sinon le clic part sur un
  // formulaire pas encore branche).
  await page.waitForLoadState("networkidle");
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(toggle).not.toBeChecked();

  await page.goto(worldUrl);
  await expect(async () => {
    if (!(await page.getByLabel("Nom", { exact: true }).isVisible())) {
      await page.getByTestId("create-entity-trigger").click();
    }
    await expect(page.getByLabel("Nom", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const combobox = page.getByRole("combobox", { name: "Type", exact: true });
  await combobox.click();
  await combobox.fill("Prophétie");
  await expect(page.getByText("Aucun type trouvé.", { exact: true })).toBeVisible();

  await page.goto(entreeUrl);
  await expect(badgeDeType(page, "Prophétie")).toBeVisible();
});

test("supprimer un type personnalise avec reaffectation change le type de ses entrees", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "types-supprimer");
  await creerTypePerso(page, worldUrl, "Vaisseau", "Objets");
  const entreeUrl = await creerEntree(
    page,
    worldUrl,
    `Brise-Lame ${Date.now()}`,
    "Vaisseau (type personnalisé)",
  );

  await page.goto(`${worldUrl}/settings/types`);
  await expect(async () => {
    if (!(await page.getByRole("dialog").isVisible())) {
      await page.getByRole("button", { name: "Supprimer le type Vaisseau", exact: true }).click();
    }
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const dialog = page.getByRole("dialog");
  const confirmer = dialog.getByRole("button", { name: "Supprimer le type", exact: true });
  await expect(confirmer).toBeDisabled();
  await dialog
    .getByLabel("Réaffecter toutes ces entrées à…", { exact: true })
    .selectOption("object");
  await expect(confirmer).toBeEnabled();
  await confirmer.click();

  const section = page.getByRole("region", { name: "Types personnalisés", exact: true });
  await expect(section.getByText("Aucun type personnalisé pour le moment.")).toBeVisible();

  await page.goto(entreeUrl);
  await expect(badgeDeType(page, "Objet")).toBeVisible();
});

test("supprimer un monde contenant des entrees de type personnalise ne leve aucune erreur", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "types-monde");
  await creerTypePerso(page, worldUrl, "Vaisseau", "Objets");
  await creerEntree(page, worldUrl, `Aube Grise ${Date.now()}`, "Vaisseau (type personnalisé)");

  await page.goto(`${worldUrl}/settings`);
  await expect(async () => {
    if (!(await page.getByRole("alertdialog").isVisible())) {
      await page.getByRole("button", { name: "Supprimer ce monde", exact: true }).click();
    }
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Confirmer la suppression", exact: true }).click();

  // Redirection vers /worlds = deleteWorldAction a abouti (un echec garderait
  // la boite ouverte avec son message, cf. delete-world-form.tsx).
  await page.waitForURL("**/worlds");
  const reponse = await page.request.get(worldUrl);
  expect(reponse.status()).toBe(404);
});
