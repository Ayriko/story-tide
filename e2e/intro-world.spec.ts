import { expect, test } from "@playwright/test";

// TST-ONB-001 (docs/cahier-recettes.md) : inscription -> monde d'introduction
// "Atheraus" (KAN-35) present et peuple, hors quota, et re-scan qui
// n'ecrase pas les Relation origin=MANUAL. Test volontairement plus lent que
// les autres (25 entites + enfilage de jobs de liaison reels) : timeout etendu.
test.setTimeout(120_000);

test("inscription cree le monde d'introduction Atheraus (peuple, hors quota, MANUAL survit)", async ({
  page,
}) => {
  const uniqueEmail = `intro-world-${Date.now()}@story-tide.test`;

  // 1. Inscription SANS cocher "Ne pas creer le monde d'exemple" (comportement
  // par defaut, opt-out - decision actee KAN-35).
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Intro World Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-intro-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  // 2. Le monde "Atheraus" apparait immediatement dans la liste (cree de
  // facon synchrone par registerAction, latence mesuree ~300ms en local).
  const atherausLink = page.getByRole("link", { name: "Atheraus" });
  await expect(atherausLink).toBeVisible();
  await atherausLink.click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Atheraus");

  // 3. La fiche "Ordre du Verbe Clos" existe (article de convergence, cas 7 du
  // contrat) et porte deja la mention manuelle vers "Selvenn" (Relation
  // MANUAL, ecrite de facon synchrone au seed - jamais besoin d'attendre le
  // worker pour celle-ci). Le nom apparait a la fois dans la Sidebar et dans
  // "Dernieres entrees" du dashboard - scope explicite sur la Sidebar (meme
  // convention que les autres e2e) pour lever l'ambiguite. Pas de exact:true -
  // le nom accessible du lien inclut aussi le libelle du type
  // ("Ordre du Verbe Clos Ordre", cf. entity-search.tsx).
  const sidebarNav = page.getByRole("navigation", { name: "Entrées du monde" });
  await sidebarNav.getByRole("link", { name: "Ordre du Verbe Clos" }).click();
  await page.waitForURL(/\/entities\/[^/]+$/);
  const linkedEntitiesNav = page.getByRole("navigation", { name: "Renvois" });
  await expect(linkedEntitiesNav.getByRole("link", { name: "Selvenn" })).toBeVisible();

  // 4. Au moins une Relation AUTO apparait apres passage du worker (poll par
  // rechargements successifs - meme patron que link-highlight.spec.ts,
  // fenetre plus large : 25 entites a traiter, pas 1).
  await expect(async () => {
    await page.reload();
    await expect(linkedEntitiesNav.getByRole("link", { name: "Elenya Vhelmire" })).toBeVisible();
  }).toPass({ timeout: 90_000 });

  // 5. Un nouveau passage du worker (declenche par un re-save neutre) ne doit
  // pas ecraser la Relation MANUAL vers "Selvenn" (critere §9 du contrat).
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");
  await page.keyboard.press("Backspace");
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });
  await expect(async () => {
    await page.reload();
    await expect(linkedEntitiesNav.getByRole("link", { name: "Selvenn" })).toBeVisible();
  }).toPass({ timeout: 20_000 });

  // 6. Le monde d'introduction est hors quota : 3 mondes USER supplementaires
  // restent creables malgre la presence d'Atheraus (origin=INTRO).
  await page.goto("/worlds");
  for (let i = 1; i <= 3; i++) {
    await page.getByRole("button", { name: "+ Nouveau monde" }).click();
    await page.getByLabel("Nom du monde").fill(`Monde Quota ${i} ${Date.now()}`);
    await page.getByRole("button", { name: "Créer le monde" }).click();
    await page.waitForURL(/\/worlds\/[^/]+$/);
    await page.goto("/worlds");
  }
});
