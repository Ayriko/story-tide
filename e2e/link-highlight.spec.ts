import { expect, test } from "@playwright/test";

// Preuve bout en bout du differenciateur produit (KAN-19, surlignage) : le
// surlignage LIVE dans l'editeur (scan client, sans le worker) et la liste
// "Entites liees" PERSISTEE (Relation ecrite par le vrai worker, demarre par
// e2e/global-setup.ts pour ce run) doivent converger vers la meme cible.
// Couvre aussi la regle d'interaction validee avec Aymeric : clic simple =
// edition normale, Ctrl/Cmd+clic = navigation - jamais l'inverse.

test("surlignage live + navigation (liste accessible et Ctrl/Cmd+clic)", async ({ page }) => {
  const uniqueEmail = `link-highlight-${Date.now()}@story-tide.test`;

  // 1. Inscription + creation d'un monde (meme parcours que smoke.spec.ts).
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Link Highlight Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-highlight-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Highlight ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Creer l'entite CIBLE (ce que la fiche B va mentionner).
  const targetName = `Aldric ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(targetName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  const targetMatch = /\/entities\/([^/]+)$/.exec(page.url());
  // Le groupe captant existe forcement des lors que le regex matche (une
  // seule paire de parentheses dans le pattern) - noUncheckedIndexedAccess
  // type quand meme l'acces en string|undefined.
  if (!targetMatch || targetMatch[1] === undefined) {
    throw new Error("id de l'entite cible introuvable dans l'URL");
  }
  const targetId = targetMatch[1];

  // 3. Retour au monde, creer la fiche SOURCE (celle qui va mentionner la cible).
  await page.goto(worldUrl);
  const sourceName = `Chronique ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(sourceName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  const sourceUrl = page.url();

  // 4. Ecrire un texte mentionnant la cible - le surlignage doit apparaitre
  // EN DIRECT (scan client, aucune dependance au worker a ce stade).
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(`Le roi ${targetName} regne sur ces terres.`);

  const mention = page.locator(".entity-mention").first();
  await expect(mention).toBeVisible();
  await expect(mention).toHaveText(targetName);
  await expect(mention).toHaveAttribute("data-target-id", targetId);

  // 5. Attendre l'autosave (debounce 1,5s + Server Action) - persiste le
  // contenu ET enfile le job de liaison AVANT de continuer, pour laisser un
  // maximum de temps au worker pendant les etapes suivantes.
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // 6. Clic simple sur la mention = edition normale, jamais de navigation.
  await mention.click();
  expect(page.url()).toBe(sourceUrl);

  // 7. Ctrl/Cmd+clic sur la mention = navigation vers la fiche liee.
  await mention.click({ modifiers: ["Control"] });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
  expect(page.url()).toContain(`/entities/${targetId}`);

  // 8-9. Retour sur la fiche source : la liste "Entites liees" (chemin
  // clavier/lecteur d'ecran, RGAA) doit refleter la Relation origin=AUTO
  // ecrite par le worker - poll par rechargements successifs, le rendu etant
  // cote serveur (RSC), pas reactif a un evenement client. Le clic sur le
  // lien (etape 9) reste DANS le meme bloc de retry que le reload (etape 8) -
  // juste apres un reload, la page peut ne pas encore etre pleinement
  // interactive (hydratation), un clic peut alors ne rien declencher de
  // fiable (flake constate en CI, jamais reproduit en local : lien visible
  // mais clic sans effet, page restee sur la fiche source). Si le clic ou la
  // navigation echouent, le retry refait un reload() et retente le cycle
  // complet plutot que d'echouer immediatement sur un lien juste visible.
  await page.goto(sourceUrl);
  const linkedEntitiesNav = page.getByRole("navigation", { name: "Renvois" });
  await expect(async () => {
    await page.reload();
    const link = linkedEntitiesNav.getByRole("link", { name: targetName });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
  }).toPass({ timeout: 20_000 });
});
