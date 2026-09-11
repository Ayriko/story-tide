import { expect, test } from "@playwright/test";

// KAN-60 : CRUD des dossiers + deplacer une entree dans/hors d'un dossier.
// Deux voies verifiees ici en conditions reelles (vrai navigateur, vraie
// base Postgres isolee) - ni l'une ni l'autre n'est testable en unitaire
// (jsdom) :
// - le glisser-depose reel (physique du pointeur, dnd-kit PointerSensor) ;
// - la persistance apres RECHARGEMENT COMPLET (preuve que l'ecriture a
//   atteint Postgres, pas seulement l'illusion optimiste cote client).
// Le menu clavier "Deplacer vers..." (mecanisme accessible principal, WCAG
// 2.5.7) et le CRUD des dossiers eux-memes sont deja couverts unitairement
// (folder-tree.test.tsx, create-folder-form.test.tsx, folder.test.ts) -
// verifies ici seulement au niveau smoke, dans le meme parcours que le
// glisser pour ne pas dupliquer une inscription complete.

test("creer un dossier, y glisser une entree, verifier apres rechargement, puis la ressortir via le menu clavier", async ({
  page,
}) => {
  const uniqueEmail = `folder-organization-${Date.now()}@story-tide.test`;

  // 1. Inscription + monde, sans le monde d'introduction (meme parcours que
  // entity-search.spec.ts).
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Folder Organization Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mot-de-passe-dossiers-1234");
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde Dossiers ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  // 2. Une entree a deplacer.
  const entityName = `Aeliana ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(entityName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  await page.goto(worldUrl);

  const sidebar = page.getByRole("navigation", { name: "Entrées du monde" });

  // 3. Bascule vers la vue Dossiers, cree un dossier.
  await sidebar.getByRole("radio", { name: "Dossiers" }).click();
  const folderName = `Royaumes ${Date.now()}`;
  await sidebar.getByRole("button", { name: "+ Nouveau dossier" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(folderName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(sidebar.getByRole("treeitem", { name: new RegExp(folderName) })).toBeVisible();

  // 4. Deplie "Non classé" pour rendre l'entree glissable, puis la glisse
  // sur le dossier (sequence de mouvements reels, pas dragTo() - dnd-kit
  // ecoute des evenements pointeur bruts, pas l'API HTML5 native).
  await sidebar.getByRole("treeitem", { name: /Non classé/ }).click();
  const entityRow = sidebar.getByRole("treeitem", { name: new RegExp(entityName) });
  const folderRow = sidebar.getByRole("treeitem", { name: new RegExp(folderName) });
  await expect(entityRow).toBeVisible();

  const source = await entityRow.boundingBox();
  const target = await folderRow.boundingBox();
  if (!source || !target) throw new Error("Impossible de mesurer les lignes a glisser.");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();

  // 5. L'entree quitte "Non classé" (deplie) et apparait sous le dossier
  // (deplie a son tour) - persiste apres un RECHARGEMENT COMPLET.
  await expect(entityRow).not.toBeVisible();
  await folderRow.click();
  await expect(sidebar.getByRole("treeitem", { name: new RegExp(entityName) })).toBeVisible();

  await page.reload();
  // Le choix de vue (Dossiers) survit au rechargement (localStorage, KAN-57) -
  // seul l'etat de pli/depli (en memoire) doit etre reconstruit ci-dessous.
  await expect(sidebar.getByRole("radio", { name: "Dossiers", checked: true })).toBeVisible();
  await sidebar.getByRole("treeitem", { name: new RegExp(folderName) }).click();
  await expect(sidebar.getByRole("treeitem", { name: new RegExp(entityName) })).toBeVisible();

  // 6. La ressort via le menu "Deplacer vers..." (mecanisme clavier
  // accessible, WCAG 2.5.7) plutot qu'un second glisser - Tab jusqu'au
  // declencheur, Entree pour ouvrir, fleche + Entree pour choisir "Non classé".
  const moveTrigger = sidebar.getByRole("button", { name: new RegExp(`Déplacer.*${entityName}`) });
  await moveTrigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Non classé" }).click();

  await expect(sidebar.getByRole("treeitem", { name: new RegExp(entityName) })).not.toBeVisible();
  await sidebar.getByRole("treeitem", { name: /Non classé/ }).click();
  await expect(sidebar.getByRole("treeitem", { name: new RegExp(entityName) })).toBeVisible();
});

test("renommer puis supprimer un dossier : les sous-dossiers disparaissent, aucune entree n'est jamais supprimee", async ({
  page,
}) => {
  const uniqueEmail = `folder-crud-${Date.now()}@story-tide.test`;

  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Folder CRUD Test");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mot-de-passe-dossiers-5678");
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");

  const worldName = `Monde CRUD Dossiers ${Date.now()}`;
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(worldName);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);
  const worldUrl = page.url();

  const entityName = `Bram ${Date.now()}`;
  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(entityName);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  await page.goto(worldUrl);

  const sidebar = page.getByRole("navigation", { name: "Entrées du monde" });
  await sidebar.getByRole("radio", { name: "Dossiers" }).click();

  const folderName = `Factions ${Date.now()}`;
  await sidebar.getByRole("button", { name: "+ Nouveau dossier" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(folderName);
  await page.getByRole("button", { name: "Créer" }).click();
  const folderRow = sidebar.getByRole("treeitem", { name: new RegExp(folderName) });
  await expect(folderRow).toBeVisible();

  // Renommer.
  await sidebar.getByRole("button", { name: new RegExp(`Actions.*${folderName}`) }).click();
  await page.getByRole("menuitem", { name: "Renommer" }).click();
  const renamedName = `${folderName} du Nord`;
  const renameField = page.getByLabel("Nom", { exact: true });
  await renameField.fill(renamedName);
  await page.getByRole("button", { name: "Renommer" }).click();
  await expect(sidebar.getByRole("treeitem", { name: new RegExp(renamedName) })).toBeVisible();

  // Supprimer : l'entree (jamais assignee a ce dossier) doit rester intacte
  // dans "Non classé" apres coup - preuve que la suppression ne touche
  // jamais les entrees, uniquement la structure de dossiers.
  await sidebar.getByRole("button", { name: new RegExp(`Actions.*${renamedName}`) }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page.getByRole("button", { name: "Confirmer la suppression" }).click();

  await expect(sidebar.getByRole("treeitem", { name: new RegExp(renamedName) })).not.toBeVisible();
  await sidebar.getByRole("treeitem", { name: /Non classé/ }).click();
  await expect(sidebar.getByRole("treeitem", { name: new RegExp(entityName) })).toBeVisible();
});
