import { expect, test, type Page } from "@playwright/test";

/**
 * Relations declarees et typees (KAN-84, ADR-0031) : declaration depuis une
 * fiche, lecture depuis l'autre, survie a la sauvegarde du texte,
 * suggestions, Constellation (une arete par paire) et types personnalises.
 *
 * Les citations passent par des mentions `@` (reconciliation SYNCHRONE,
 * ADR-0011) : aucun job de liaison attendu, aucune pression sur la file
 * partagee (cf. skill e2e-jobs-file-partagee). Chaque compte s'inscrit SANS
 * monde d'exemple.
 */

const MOT_DE_PASSE = "mot-de-passe-relations-1234";

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
// `optionType` absent = type par defaut (Personnage).
async function creerEntree(page: Page, worldUrl: string, nom: string, optionType?: string) {
  await page.goto(worldUrl);
  await expect(async () => {
    if (!(await page.getByLabel("Nom", { exact: true }).isVisible())) {
      await page.getByTestId("create-entity-trigger").click();
    }
    await expect(page.getByLabel("Nom", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  if (optionType) {
    const combobox = page.getByRole("combobox", { name: "Type", exact: true });
    await combobox.click();
    await combobox.fill(optionType);
    await page.getByRole("option", { name: optionType, exact: true }).click();
  }
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  return page.url();
}

// Ouvre la fiche, hydratation terminee : les formulaires de la section
// « Relations » passent par useActionState (pas d'amelioration progressive),
// un clic avant hydratation partirait en soumission native.
async function ouvrirFiche(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

// Cite chaque cible par une mention `@`, puis attend l'autosave.
async function citer(page: Page, cibles: string[]) {
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("End");
  for (const cible of cibles) {
    await page.keyboard.type(" @");
    await page.keyboard.type(cible);
    await expect(page.getByRole("option", { name: cible, exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("Enregistré.", { exact: true })).toBeVisible({ timeout: 10_000 });
}

function sectionRelations(page: Page) {
  return page.getByRole("region", { name: "Relations", exact: true });
}

async function declarerRelation(page: Page, choix: { label: string }, autre: string) {
  const section = sectionRelations(page);
  await section.getByLabel("Type de relation", { exact: true }).selectOption(choix);
  const cible = section.getByRole("combobox", { name: "Entrée liée", exact: true });
  await cible.click();
  await cible.fill(autre);
  // Nom de l'option = nom + type (deux <span>) : filtre sur le texte.
  await section.getByRole("option").filter({ hasText: autre }).click();
  await section.getByRole("button", { name: "Ajouter la relation", exact: true }).click();
}

// Une relation affichee sur une fiche : le libelle (<dt>) et le lien vers
// l'autre entree.
async function attendreRelation(page: Page, libelle: string, autre: string) {
  const section = sectionRelations(page);
  const terme = section.getByRole("term").filter({ hasText: libelle });
  await expect(terme).toHaveText(libelle);
  // Lien cherche dans le groupe de CE libelle (<div> parent du <dt>) : une
  // paire peut porter plusieurs relations.
  await expect(
    terme.locator("xpath=..").getByRole("link", { name: autre, exact: true }),
  ).toBeVisible();
}

test("une relation declaree se lit depuis la cible et survit a la sauvegarde du texte", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "rel-declarer");
  const id = Date.now();
  const aldric = `Aldric ${id}`;
  const selyne = `Selyne ${id}`;
  const aldricUrl = await creerEntree(page, worldUrl, aldric);
  const selyneUrl = await creerEntree(page, worldUrl, selyne);

  await ouvrirFiche(page, selyneUrl);
  await declarerRelation(page, { label: "Parent de" }, aldric);
  await attendreRelation(page, "Parent de", aldric);

  await ouvrirFiche(page, aldricUrl);
  await attendreRelation(page, "Enfant de", selyne);

  // Sauvegarde SANS `@` : reconcileManualMentions ne touche jamais une
  // relation declaree (table separee).
  await ouvrirFiche(page, selyneUrl);
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Une reine sans couronne.");
  await expect(page.getByText("Enregistré.", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await attendreRelation(page, "Parent de", aldric);
});

test("une entree citee est suggeree avec un type pre-selectionne ; une suggestion ignoree ne revient pas", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "rel-suggerer");
  const id = Date.now();
  const portBrume = `Port-Brume ${id}`;
  const mira = `Mira ${id}`;
  await creerEntree(page, worldUrl, portBrume, "Lieu");
  await creerEntree(page, worldUrl, mira);
  const selyneUrl = await creerEntree(page, worldUrl, `Selyne ${id}`);

  await ouvrirFiche(page, selyneUrl);
  await citer(page, [portBrume, mira]);
  await ouvrirFiche(page, selyneUrl);

  const section = sectionRelations(page);
  // Personnage -> Lieu : « Situe dans » pre-selectionne.
  await expect(
    section.getByLabel(`Type de relation avec ${portBrume}`, { exact: true }),
  ).toHaveValue("located|source");
  await section
    .getByRole("button", { name: `Ajouter la relation avec ${portBrume}`, exact: true })
    .click();
  await attendreRelation(page, "Situé dans", portBrume);
  await expect(
    section.getByRole("button", { name: `Ajouter la relation avec ${portBrume}`, exact: true }),
  ).toHaveCount(0);

  await section.getByRole("button", { name: `Ignorer la suggestion ${mira}`, exact: true }).click();
  await expect(section.getByText("1 suggestion ignorée", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    section.getByRole("button", { name: `Ajouter la relation avec ${mira}`, exact: true }),
  ).toHaveCount(0);
  await expect(section.getByText("1 suggestion ignorée", { exact: true })).toBeVisible();
});

test("Constellation : une paire citee ET declaree n'a qu'une arete, au libelle declare", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "rel-graphe");
  const id = Date.now();
  const aldric = `Aldric ${id}`;
  await creerEntree(page, worldUrl, aldric);
  const selyneUrl = await creerEntree(page, worldUrl, `Selyne ${id}`);

  await ouvrirFiche(page, selyneUrl);
  await citer(page, [aldric]);
  await ouvrirFiche(page, selyneUrl);
  await declarerRelation(page, { label: "Parent de" }, aldric);
  await attendreRelation(page, "Parent de", aldric);

  await page.goto(`${worldUrl}/graph`);
  await expect(page.getByTestId("graph-canvas").locator("canvas").first()).toBeVisible();
  // La liste accessible est construite par la meme fonction de paires que
  // les aretes Cytoscape (graph-elements.ts) : un seul lien vers Aldric, au
  // libelle declare - pas de second lien « → Aldric » pour la mention.
  await page.getByRole("button", { name: "Observer les fils", exact: true }).click();
  const liste = page.getByRole("navigation", {
    name: "Liste des liens de la constellation",
    exact: true,
  });
  await expect(
    liste.getByRole("link", { name: `Parent de → ${aldric}`, exact: true }),
  ).toBeVisible();
  await expect(liste.getByRole("link", { name: `→ ${aldric}`, exact: true })).toHaveCount(0);
  await expect(liste.getByRole("link", { name: `↔ ${aldric}`, exact: true })).toHaveCount(0);
});

test("un type de relation personnalise se cree, s'utilise et se supprime avec reaffectation", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "rel-types");
  const id = Date.now();
  const aldric = `Aldric ${id}`;
  const aldricUrl = await creerEntree(page, worldUrl, aldric);
  const selyneUrl = await creerEntree(page, worldUrl, `Selyne ${id}`);

  await page.goto(`${worldUrl}/settings/relations`);
  await expect(async () => {
    if (!(await page.getByLabel("Libellé", { exact: true }).isVisible())) {
      await page.getByRole("button", { name: "Nouveau type", exact: true }).click();
    }
    await expect(page.getByLabel("Libellé", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Libellé", { exact: true }).fill("Suzerain de");
  await page.getByLabel("Libellé inverse", { exact: true }).fill("Vassal de");
  await page.getByRole("button", { name: "Créer le type", exact: true }).click();
  const types = page.getByRole("region", { name: "Types personnalisés", exact: true });
  await expect(types.getByText("Suzerain de", { exact: true })).toBeVisible();

  // Le type perso, et « Dirige » sur la meme paire : la reaffectation vers
  // « Dirige » doit absorber le doublon au lieu de le dupliquer.
  await ouvrirFiche(page, selyneUrl);
  await declarerRelation(page, { label: "Suzerain de (perso)" }, aldric);
  await attendreRelation(page, "Suzerain de", aldric);
  await declarerRelation(page, { label: "Dirige" }, aldric);
  await attendreRelation(page, "Dirige", aldric);
  await ouvrirFiche(page, aldricUrl);
  await attendreRelation(page, "Vassal de", `Selyne ${id}`);

  await page.goto(`${worldUrl}/settings/relations`);
  await expect(async () => {
    if (!(await page.getByRole("dialog").isVisible())) {
      await page
        .getByRole("button", { name: "Supprimer le type Suzerain de", exact: true })
        .click();
    }
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const dialog = page.getByRole("dialog");
  const confirmer = dialog.getByRole("button", { name: "Supprimer le type", exact: true });
  await expect(confirmer).toBeDisabled();
  await dialog
    .getByLabel("Réaffecter toutes ces relations à…", { exact: true })
    .selectOption("leads");
  await expect(dialog.getByText("Déjà présente : sera supprimée.", { exact: true })).toBeVisible();
  await expect(confirmer).toBeEnabled();
  await confirmer.click();
  await expect(
    types.getByText("Aucun type personnalisé pour le moment.", { exact: true }),
  ).toBeVisible();

  await ouvrirFiche(page, selyneUrl);
  const section = sectionRelations(page);
  await attendreRelation(page, "Dirige", aldric);
  await expect(section.getByText("Suzerain de", { exact: true })).toHaveCount(0);
  // Doublon absorbe : une seule relation vers Aldric.
  await expect(section.getByRole("link", { name: aldric, exact: true })).toHaveCount(1);
});
