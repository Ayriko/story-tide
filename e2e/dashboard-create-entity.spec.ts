import { expect, test } from "@playwright/test";

// BUG-004 (2026-07-21/22) : creer une entree via le bouton du DASHBOARD ne
// rafraichissait jamais la Sidebar au retour dessus, alors que la meme
// creation depuis le bouton de la Sidebar semblait fonctionner par hasard.
// Cause reelle (prouvee par log, pas par hypothese) : entity-search.tsx
// copiait la prop `initialEntities` dans un `useState` au premier montage -
// ce composant vit dans worlds/[slug]/layout.tsx, qui persiste a travers
// toutes les navigations internes au monde, donc les props plus recentes
// (nouvelle entree creee) etaient silencieusement ignorees. Deux tentatives
// `revalidatePath` cote serveur n'avaient rien resolu (le probleme etait
// cote client) - voir docs/plan-correction-bogues.md (BUG-004). Ce test
// couvre exactement le trou qui a laisse passer le bug DEUX fois : la
// verification "l'entree apparait dans la sidebar SANS rechargement".

test("creer une entree depuis le dashboard met a jour la Sidebar sans rechargement (BUG-004)", async ({
  page,
}) => {
  const uniqueEmail = `dashboard-create-${Date.now()}@story-tide.test`;

  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Dashboard Create Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-dashcreate-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde DashCreate ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  const breadcrumbWorldLink = page
    .getByRole("navigation", { name: "Fil d'ariane" })
    .getByRole("link", { name: worldName });
  const sidebarNav = page.getByRole("navigation", { name: "Entrées du monde" });

  // 1. Creation DEPUIS LE DASHBOARD - le cas qui etait casse.
  const nameFromDashboard = `EntreeDashboard${Date.now()}`;
  await page.getByTestId("dashboard-create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(nameFromDashboard);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await breadcrumbWorldLink.click();
  await page.waitForURL(worldUrl);
  await expect(sidebarNav.getByText(nameFromDashboard, { exact: true })).toBeVisible();

  // 2. Creation DEPUIS LA SIDEBAR - non-regression (deja "nickel" en
  // apparence, mais non deterministe avant le correctif : a son tour prouve).
  const nameFromSidebar = `EntreeSidebar${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(nameFromSidebar);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await breadcrumbWorldLink.click();
  await page.waitForURL(worldUrl);
  await expect(sidebarNav.getByText(nameFromSidebar, { exact: true })).toBeVisible();
  // Les deux entrees precedentes restent visibles (pas de regression sur A).
  await expect(sidebarNav.getByText(nameFromDashboard, { exact: true })).toBeVisible();

  // 3. Etat plie/deplie des groupes conserve (acte le 20/07, ne doit pas
  // regresser avec la suppression du state `results`) : replier le groupe
  // "Personnages" (categorie par defaut d'une entite), creer une nouvelle
  // entree, verifier que le groupe est TOUJOURS replie au retour.
  const personnagesHeader = sidebarNav.getByRole("button", { name: "Personnages" });
  await personnagesHeader.click();
  await expect(personnagesHeader).toHaveAttribute("aria-expanded", "false");

  const nameThird = `EntreeApresRepli${Date.now()}`;
  await page.getByTestId("dashboard-create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(nameThird);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);

  await breadcrumbWorldLink.click();
  await page.waitForURL(worldUrl);
  await expect(personnagesHeader).toHaveAttribute("aria-expanded", "false");
  // La nouvelle entree existe bien (Sidebar a jour) mais reste masquee -
  // groupe toujours replie, comportement attendu.
  await expect(sidebarNav.getByText(nameThird, { exact: true })).not.toBeVisible();
  await personnagesHeader.click();
  await expect(sidebarNav.getByText(nameThird, { exact: true })).toBeVisible();

  // 4. Recherche active puis effacee : le chemin "recherche serveur" (state)
  // et le chemin "pas de recherche" (derive des props) ne doivent pas
  // s'interferer - la recherche continue de fonctionner, et l'effacer
  // reaffiche bien la liste a jour (avec les 3 entrees creees).
  const search = page.getByLabel("Rechercher une entrée");
  await search.fill(nameFromDashboard);
  await expect(sidebarNav.getByRole("link", { name: new RegExp(nameFromDashboard) })).toBeVisible();
  await expect(
    sidebarNav.getByRole("link", { name: new RegExp(nameFromSidebar) }),
  ).not.toBeVisible();

  await search.fill("");
  await expect(sidebarNav.getByText(nameFromDashboard, { exact: true })).toBeVisible();
  await expect(sidebarNav.getByText(nameFromSidebar, { exact: true })).toBeVisible();
});
