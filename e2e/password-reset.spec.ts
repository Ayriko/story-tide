import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

// Next.js rend un annonceur de route porteur de role="alert" sur chaque page :
// un getByRole("alert") nu en attraperait deux. On vise le <p role="alert"> des
// formulaires d'authentification, qui est le seul message qui nous interesse.
function alerteFormulaire(page: Page) {
  return page.locator('p[role="alert"]');
}

async function seDeconnecter(page: Page) {
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await page.waitForURL("**/login");
}

/**
 * Parcours complet de reinitialisation de mot de passe (KAN-52).
 *
 * Aucun serveur de capture de courrier n'est monte pour les tests : en e2e,
 * MAIL_TRANSPORT=memory (.env.e2e) garantit qu'aucun message ne part vraiment.
 * Le jeton est donc lu la ou Better Auth l'ecrit - la table `verification`,
 * sous l'identifiant `reset-password:<jeton>` - via pg.Client, patron deja
 * etabli dans e2e/global-setup.ts et e2e/quota.spec.ts. Le reste du parcours
 * (page, formulaire, connexion avec le nouveau mot de passe) passe par l'UI
 * reelle, exactement comme un utilisateur.
 */

const ANCIEN_MOT_DE_PASSE = "ancien-mot-de-passe-1234";
const NOUVEAU_MOT_DE_PASSE = "nouveau-mot-de-passe-5678";

async function dernierJetonDeReinitialisation(): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquant (voir e2e/global-setup.ts).");
  }
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    const { rows } = await db.query<{ identifier: string }>(
      `SELECT identifier FROM verification
       WHERE identifier LIKE 'reset-password:%'
       ORDER BY "createdAt" DESC
       LIMIT 1`,
    );
    const ligne = rows[0];
    if (!ligne) {
      throw new Error("aucun jeton de reinitialisation en base");
    }
    return ligne.identifier.replace("reset-password:", "");
  } finally {
    await db.end();
  }
}

test("mot de passe oublie : demande, nouveau mot de passe, connexion", async ({ page }) => {
  const email = `reset-${Date.now()}@story-tide.test`;

  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Testeur reset");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(ANCIEN_MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  // Se deconnecter : le parcours se joue toujours hors session.
  await seDeconnecter(page);

  // Le point d'entree doit exister depuis la page de connexion.
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await page.waitForURL("**/forgot-password");

  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status")).toContainText("Si un compte existe pour cette adresse");

  const jeton = await dernierJetonDeReinitialisation();

  // Le lien recu passe par l'endpoint de verification, qui redirige vers la
  // page avec le jeton valide : on emprunte exactement ce chemin.
  await page.goto(`/api/auth/reset-password/${jeton}?callbackURL=%2Freset-password`);
  await page.waitForURL(/\/reset-password\?token=/);

  await page.getByLabel("Nouveau mot de passe").fill(NOUVEAU_MOT_DE_PASSE);
  await page.getByLabel("Confirmer le mot de passe").fill(NOUVEAU_MOT_DE_PASSE);
  await page.getByRole("button", { name: /enregistrer le nouveau mot de passe/i }).click();
  await page.waitForURL(/\/login\?reinitialise=1/);
  await expect(page.getByRole("status")).toContainText("Mot de passe modifié");

  // L'ancien mot de passe ne doit plus fonctionner.
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(ANCIEN_MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(alerteFormulaire(page)).toContainText("E-mail ou mot de passe incorrect.");

  // Le nouveau, si.
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(NOUVEAU_MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/worlds");
  await expect(page.getByRole("heading", { name: "Mes mondes" })).toBeVisible();
});

test("un jeton deja consomme ne permet pas une seconde reinitialisation", async ({ page }) => {
  const email = `reset-rejeu-${Date.now()}@story-tide.test`;

  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Testeur rejeu");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(ANCIEN_MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  // /forgot-password redirige vers l'accueil tant qu'une session est ouverte.
  await seDeconnecter(page);

  await page.goto("/forgot-password");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  const jeton = await dernierJetonDeReinitialisation();

  await page.goto(`/reset-password?token=${jeton}`);
  await page.getByLabel("Nouveau mot de passe").fill(NOUVEAU_MOT_DE_PASSE);
  await page.getByLabel("Confirmer le mot de passe").fill(NOUVEAU_MOT_DE_PASSE);
  await page.getByRole("button", { name: /enregistrer le nouveau mot de passe/i }).click();
  await page.waitForURL(/\/login\?reinitialise=1/);

  // Rejeu du meme lien : le jeton a ete consomme, l'utilisateur doit le savoir
  // et pouvoir rebondir plutot que rester sur une page morte.
  await page.goto(`/reset-password?token=${jeton}`);
  await page.getByLabel("Nouveau mot de passe").fill("encore-un-autre-9999");
  await page.getByLabel("Confirmer le mot de passe").fill("encore-un-autre-9999");
  await page.getByRole("button", { name: /enregistrer le nouveau mot de passe/i }).click();
  await expect(alerteFormulaire(page)).toContainText("invalide ou a expiré");
  await expect(page.getByRole("link", { name: /demander un nouveau lien/i })).toBeVisible();
});

test("la demande ne revele pas si une adresse a un compte", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail").fill(`inconnue-${Date.now()}@story-tide.test`);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();

  // Adresse sans compte : reponse strictement identique au cas nominal.
  await expect(page.getByRole("status")).toContainText("Si un compte existe pour cette adresse");
  await expect(alerteFormulaire(page)).toHaveCount(0);
});
