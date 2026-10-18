import { expect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";

/**
 * Administration (KAN-72 lot 1) : garde 404-identique, tableau de bord, liste,
 * changement de plan qui leve le quota, journal.
 *
 * Aucun job de liaison : chaque compte s'inscrit SANS monde d'exemple et les
 * mondes crees restent vides - ce spec ne pese pas sur la file partagee
 * (cf. skill e2e-jobs-file-partagee).
 *
 * Promotion ADMIN par pg.Client (patron de quota.spec.ts / password-reset.spec.ts) :
 * aucune interface ne permet de devenir administrateur, c'est voulu.
 */

const MOT_DE_PASSE = "mot-de-passe-admin-1234";

async function inscrire(page: Page, nom: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await page.waitForURL("**/worlds");
}

async function promouvoirAdmin(email: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquant (voir e2e/global-setup.ts).");
  }
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    const { rowCount } = await db.query(`UPDATE "user" SET role = 'ADMIN' WHERE email = $1`, [
      email,
    ]);
    if (rowCount !== 1) {
      throw new Error(`promotion impossible : ${rowCount} ligne(s) pour ${email}`);
    }
  } finally {
    await db.end();
  }
}

async function creerMonde(page: Page, nom: string) {
  await page.goto("/worlds");
  await page.getByRole("button", { name: "+ Nouveau monde", exact: true }).click();
  await page.getByLabel("Nom du monde", { exact: true }).fill(nom);
  await page.getByRole("button", { name: "Créer le monde", exact: true }).click();
}

// Corps de la reponse sans ce qui change a chaque requete (identifiant de
// rendu de Next) ni le chemin demande lui-meme : ce qui reste doit etre
// strictement identique entre /admin et une route qui n'existe pas.
function corpsNormalise(html: string, chemin: string): string {
  return html.replaceAll(chemin, "CHEMIN").replace(/self\.__next_r="[^"]*"/, "");
}

async function nouveauCompte(browser: Browser, nom: string, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await inscrire(page, nom, email);
  return { context, page };
}

test("/admin repond comme une route inexistante a un anonyme et a un compte standard", async ({
  page,
}) => {
  const comparer = async (libelle: string) => {
    const admin = await page.request.get("/admin");
    const inexistante = await page.request.get("/admix");
    expect(admin.status(), `${libelle} : statut de /admin`).toBe(404);
    expect(inexistante.status(), `${libelle} : statut de /admix`).toBe(404);
    expect(corpsNormalise(await admin.text(), "admin"), `${libelle} : corps de /admin`).toBe(
      corpsNormalise(await inexistante.text(), "admix"),
    );

    for (const chemin of ["/admin/users", "/admin/users/abc"]) {
      expect((await page.request.get(chemin)).status(), `${libelle} : ${chemin}`).toBe(404);
    }
  };

  // Anonyme : aucune redirection vers /login, qui trahirait l'existence de la route.
  await comparer("anonyme");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("This page could not be found.")).toBeVisible();

  // Compte standard : meme reponse, et aucun lien "Administration" dans son
  // pied de page (le lien "Mentions légales" prouve que le pied est bien rendu).
  await inscrire(page, "Standard Admin Test", `admin-standard-${Date.now()}@story-tide.test`);
  await comparer("compte standard");
  await page.goto("/worlds");
  const piedDePage = page.getByRole("contentinfo");
  await expect(
    piedDePage.getByRole("link", { name: "Mentions légales", exact: true }),
  ).toBeAttached();
  await expect(piedDePage.getByRole("link", { name: "Administration", exact: true })).toHaveCount(
    0,
  );
});

test("un compte promu ADMIN voit le tableau de bord et la liste des utilisateurs", async ({
  page,
}) => {
  const email = `admin-vue-${Date.now()}@story-tide.test`;
  await inscrire(page, "Admin Vue Test", email);
  await promouvoirAdmin(email);

  // Le role est relu en base : pas besoin de se reconnecter apres la promotion.
  await page.goto("/worlds");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Administration", exact: true })
    .click();
  await page.waitForURL("**/admin");

  await expect(page.getByRole("heading", { name: "Tableau de bord", exact: true })).toBeVisible();
  for (const bloc of ["Utilisateurs", "Contenu", "Activité sur 30 jours", "Quotas"]) {
    await expect(page.getByRole("heading", { name: bloc, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Version déployée", exact: true })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Sections d'administration" })
    .getByRole("link", { name: "Utilisateurs", exact: true })
    .click();
  await page.waitForURL("**/admin/users");

  await page.getByLabel("Rechercher par e-mail ou nom", { exact: true }).fill("ADMIN VUE");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page).toHaveURL(/q=ADMIN(\+|%20)VUE/);
  await expect(page.getByRole("link", { name: email, exact: true })).toBeVisible();

  // Toute la ligne ouvre la fiche, pas seulement l'e-mail : clic au centre de
  // la cellule du nom, qui ne contient aucun lien. Clic par coordonnees et non
  // locator.click() : le lien etire recouvre la cellule, ce que Playwright
  // refuse comme "intercepte" alors que c'est exactement le comportement voulu.
  const celluleNom = await page
    .getByRole("cell", { name: "Admin Vue Test", exact: true })
    .boundingBox();
  if (!celluleNom) {
    throw new Error("cellule du nom introuvable dans la liste");
  }
  await page.mouse.click(celluleNom.x + celluleNom.width / 2, celluleNom.y + celluleNom.height / 2);
  await page.waitForURL(/\/admin\/users\/[^/]+$/);
  await expect(page.getByRole("heading", { name: email, exact: true })).toBeVisible();
});

test("passer un compte FREE en UNLIMITED leve le quota de mondes, et la fiche garde la trace", async ({
  browser,
}) => {
  const suffixe = Date.now();
  const emailAdmin = `admin-plan-${suffixe}@story-tide.test`;
  const emailCible = `admin-cible-${suffixe}@story-tide.test`;

  const cible = await nouveauCompte(browser, "Cible Plan Test", emailCible);
  const admin = await nouveauCompte(browser, "Admin Plan Test", emailAdmin);
  await promouvoirAdmin(emailAdmin);

  // Le compte cible atteint le plafond gratuit : 3 mondes, le 4e est refuse.
  for (let i = 1; i <= 3; i++) {
    await creerMonde(cible.page, `Monde Plan ${i} ${suffixe}`);
    await cible.page.waitForURL(/\/worlds\/[^/]+$/);
  }
  await creerMonde(cible.page, `Monde Plan 4 ${suffixe}`);
  await expect(
    cible.page.getByText("Limite de mondes atteinte pour l'offre gratuite (3 maximum)."),
  ).toBeVisible();

  // L'administrateur le retrouve parmi les comptes proches du plafond, puis
  // change son plan avec une raison.
  await admin.page.goto("/admin");
  await admin.page.getByRole("link", { name: emailCible, exact: true }).first().click();
  await admin.page.waitForURL(/\/admin\/users\/[^/]+$/);
  await expect(admin.page.getByText("Aucune action sur ce compte.")).toBeVisible();

  // Raison trop courte : refusee, rien n'est ecrit.
  await admin.page.getByLabel("Nouveau plan", { exact: true }).click();
  await admin.page.getByRole("option", { name: "UNLIMITED", exact: true }).click();
  await admin.page.getByLabel("Raison du changement de plan", { exact: true }).fill("ami");
  await admin.page.getByRole("button", { name: "Changer le plan", exact: true }).click();
  await expect(admin.page.getByText("La raison doit faire au moins 5 caractères.")).toBeVisible();
  await expect(admin.page.getByText("Aucune action sur ce compte.")).toBeVisible();

  await admin.page.getByLabel("Nouveau plan", { exact: true }).click();
  await admin.page.getByRole("option", { name: "UNLIMITED", exact: true }).click();
  await admin.page
    .getByLabel("Raison du changement de plan", { exact: true })
    .fill("compte offert pour la recette");
  await admin.page.getByRole("button", { name: "Changer le plan", exact: true }).click();
  await expect(admin.page.getByText("Plan passé à UNLIMITED.")).toBeVisible();

  // Journal : qui, quoi, avant -> apres, pourquoi.
  const ligne = admin.page.getByRole("row").filter({ hasText: "compte offert pour la recette" });
  await expect(ligne).toContainText("Admin Plan Test");
  await expect(ligne).toContainText("Changement de plan");
  await expect(ligne).toContainText("plan : FREE, planSource : DEFAULT");
  await expect(ligne).toContainText("plan : UNLIMITED, planSource : MANUAL");

  // Le compte cible cree maintenant son 4e monde, sans se reconnecter.
  await creerMonde(cible.page, `Monde Plan 4 ${suffixe}`);
  await cible.page.waitForURL(/\/worlds\/[^/]+$/);

  await admin.context.close();
  await cible.context.close();
});
