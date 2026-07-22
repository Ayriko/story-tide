import { expect, test } from "@playwright/test";

// Preuve bout en bout des mentions manuelles @ (KAN-22) : popup de suggestion,
// insertion du node mention, reconciliation SYNCHRONE des Relation
// origin=MANUAL (contrairement au scan AUTO, asynchrone via le worker - pas
// besoin d'attendre un job ici), visibles des DEUX cotes ("Entites liees" et
// "Mentionne par"). La navigation (Ctrl/Cmd+clic, clic simple = edition)
// reutilise le meme mecanisme que le surlignage live, deja couvert par
// e2e/link-highlight.spec.ts - verifiee ici brievement en non-regression.

test("mention manuelle @ : popup, insertion, relation MANUAL bidirectionnelle", async ({
  page,
}) => {
  const uniqueEmail = `manual-mention-${Date.now()}@story-tide.test`;

  // 1. Inscription + creation d'un monde.
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Manual Mention Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-mention-1234");
  // Saute le monde d'introduction "Atheraus" (KAN-35) : ce test ne le
  // concerne pas, et son seed (25 entites + enfilage de jobs) ralentirait/
  // ferait concourir la file de liaison partagee avec les autres jobs e2e.
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Mention ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Creer l'entite CIBLE (celle qui sera mentionnee via @).
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

  // 3. Creer la fiche SOURCE (celle qui va mentionner la cible via @).
  await page.goto(worldUrl);
  const sourceName = `Chronique ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(sourceName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  const sourceUrl = page.url();

  // 4. Taper "@" declenche la popup de suggestion ; la selectionner insere
  // le node mention (pas de texte "@" residuel, pas de prefixe visible).
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("L'allie de @");
  await page.keyboard.type(targetName);
  const suggestionOption = page.getByRole("option", { name: targetName });
  await expect(suggestionOption).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("depuis toujours.");

  const mention = page.locator(".entity-mention").first();
  await expect(mention).toBeVisible();
  await expect(mention).toHaveText(targetName);
  await expect(mention).toHaveAttribute("data-target-id", targetId);

  // 5. Attendre l'autosave - saveEntityContentAction reconcilie les
  // Relation MANUAL de facon SYNCHRONE (contrairement a l'enfilage AUTO,
  // traite plus tard par le worker) : pas besoin d'attendre un job ici.
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // 6. Clic simple = edition normale, jamais de navigation (meme regle que
  // le surlignage live).
  await mention.click();
  expect(page.url()).toBe(sourceUrl);

  // 7. Ctrl/Cmd+clic = navigation vers la fiche mentionnee.
  await mention.click({ modifiers: ["Control"] });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(targetName);
  expect(page.url()).toContain(`/entities/${targetId}`);

  // 8. Cote fiche source : "Entites liees" reflete la Relation MANUAL des
  // le premier rechargement (reconciliation synchrone, pas de polling requis
  // comme pour l'AUTO).
  await page.goto(sourceUrl);
  await page.reload();
  const linkedEntitiesNav = page.getByRole("navigation", { name: "Renvois" });
  await expect(linkedEntitiesNav.getByRole("link", { name: targetName })).toBeVisible();

  // 9. Cote fiche cible : "Mentionne par" reflete la meme relation, vue
  // depuis l'autre sens (backlinks, KAN-24).
  await page.goto(`${worldUrl}/entities/${targetId}`);
  const mentionedByNav = page.getByRole("navigation", { name: "Échos" });
  await expect(mentionedByNav.getByRole("link", { name: sourceName })).toBeVisible();
});
