import { expect, test, type Page } from "@playwright/test";

/**
 * Constellation (KAN-87, ADR-0032) : la page d'un monde, sa disposition
 * memorisee, la liaison par geste, Reorganiser / Annuler et l'isolement.
 *
 * Positions lues par le crochet de test `window.__storyTideConstellation`
 * (graph-view.tsx), pose UNIQUEMENT quand NEXT_PUBLIC_E2E_HOOKS === "1"
 * (webServer de playwright.config.ts). Aucune citation de texte : aucun job
 * de liaison attendu sur la file partagee (skill e2e-jobs-file-partagee).
 */

const MOT_DE_PASSE = "mot-de-passe-constellation-1234";

type Star = {
  id: string;
  label: string;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  opacity: number;
  dimmed: boolean;
  named: boolean;
};

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

// Creation par le bouton rond de la Constellation ; clic et ouverture dans
// le meme retry (hydratation apres goto, cf. graph.spec.ts).
async function creerEntree(page: Page, worldUrl: string, nom: string): Promise<string> {
  await page.goto(worldUrl);
  await expect(async () => {
    if (!(await page.getByLabel("Nom", { exact: true }).isVisible())) {
      await page.getByTestId("dashboard-create-entity-trigger").click();
    }
    await expect(page.getByLabel("Nom", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
  return page.url();
}

function sectionRelations(page: Page) {
  return page.getByRole("region", { name: "Relations", exact: true });
}

// Relation declaree depuis la fiche (chemin clavier de KAN-84).
async function declarerRelation(page: Page, ficheUrl: string, libelle: string, autre: string) {
  await page.goto(ficheUrl);
  await page.waitForLoadState("networkidle");
  const section = sectionRelations(page);
  await section.getByLabel("Type de relation", { exact: true }).selectOption({ label: libelle });
  const cible = section.getByRole("combobox", { name: "Entrée liée", exact: true });
  await cible.click();
  await cible.fill(autre);
  await section.getByRole("option").filter({ hasText: autre }).click();
  await section.getByRole("button", { name: "Ajouter la relation", exact: true }).click();
  await expect(section.getByRole("link", { name: autre, exact: true })).toBeVisible();
}

// Ouvre la Constellation et attend que toutes les etoiles soient posees, la
// sauvegarde initiale de leurs places terminee, et leurs positions A L'ECRAN
// stables : la sidebar peut s'ouvrir juste apres l'hydratation (preference
// memorisee, transition de 200 ms) et decaler tout le canvas - un clic lu
// avant ce decalage tomberait a cote de l'etoile.
async function ouvrirConstellation(page: Page, worldUrl: string, etoiles: number) {
  await page.goto(worldUrl);
  await expect
    .poll(() => page.evaluate(() => window.__storyTideConstellation?.nodes().length ?? 0))
    .toBe(etoiles);
  await page.waitForLoadState("networkidle");
  await attendrePositionsStables(page);
}

async function attendrePositionsStables(page: Page) {
  const lire = () =>
    page.evaluate(() =>
      JSON.stringify(
        (window.__storyTideConstellation?.nodes() ?? []).map(({ clientX, clientY }) => [
          Math.round(clientX),
          Math.round(clientY),
        ]),
      ),
    );
  let precedent = "";
  await expect
    .poll(async () => {
      const courant = await lire();
      const stable = courant === precedent;
      precedent = courant;
      return stable;
    })
    .toBe(true);
}

async function etoiles(page: Page): Promise<Star[]> {
  return page.evaluate(() => window.__storyTideConstellation?.nodes() ?? []);
}

async function etoile(page: Page, label: string): Promise<Star> {
  const found = (await etoiles(page)).find((star) => star.label === label);
  if (!found) {
    throw new Error(`etoile introuvable : ${label}`);
  }
  return found;
}

function places(stars: Star[]): Map<string, { x: number; y: number }> {
  return new Map(stars.map(({ id, x, y }) => [id, { x, y }]));
}

// Sauvegarde de PLACES (saveNodePositions / replaceLayout) : sa charge porte
// des entityId, contrairement a celle du cadrage (zoom, panX, panY), envoyee
// aussi apres un « ajuster » - jamais confondues.
function attendreSauvegarde(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes("entityId"),
  );
}

function expectMemesPlaces(
  actual: Map<string, { x: number; y: number }>,
  expected: Map<string, { x: number; y: number }>,
) {
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [id, place] of expected) {
    expect(actual.get(id)?.x).toBeCloseTo(place.x, 0);
    expect(actual.get(id)?.y).toBeCloseTo(place.y, 0);
  }
}

test.describe("page du monde, stockage navigateur vide", () => {
  // Sans la preference posee par playwright.config.ts : comportement par
  // defaut d'un nouvel utilisateur.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/graph redirige vers la page du monde ; sidebar repliee par defaut, depliee et memorisee", async ({
    page,
  }) => {
    const worldUrl = await inscrireEtCreerMonde(page, "const-page");

    await page.goto(`${worldUrl}/graph`);
    await page.waitForURL(worldUrl);
    await expect(page.getByTestId("graph-canvas").locator("canvas").first()).toBeVisible();

    const afficher = page.getByRole("button", {
      name: "Afficher la liste des entrées",
      exact: true,
    });
    await expect(afficher).toBeVisible();
    await afficher.click();
    await expect(
      page.getByRole("button", { name: "Masquer la liste des entrées", exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Masquer la liste des entrées", exact: true }),
    ).toBeVisible();
  });
});

test("deplacer une etoile puis recharger : meme place", async ({ page }) => {
  const worldUrl = await inscrireEtCreerMonde(page, "const-place");
  const id = Date.now();
  await creerEntree(page, worldUrl, `Selyne ${id}`);
  await creerEntree(page, worldUrl, `Aldric ${id}`);
  await ouvrirConstellation(page, worldUrl, 2);

  const selyne = await etoile(page, `Selyne ${id}`);
  await page.mouse.move(selyne.clientX, selyne.clientY);
  await page.mouse.down();
  await page.mouse.move(selyne.clientX + 120, selyne.clientY + 60, { steps: 12 });
  const sauvegarde = attendreSauvegarde(page);
  await page.mouse.up();
  await sauvegarde;
  const apres = places(await etoiles(page));
  expect(apres.get(selyne.id)?.x).not.toBeCloseTo(selyne.x, 0);

  await ouvrirConstellation(page, worldUrl, 2);
  expectMemesPlaces(places(await etoiles(page)), apres);
});

test("Shift + glisser de Selyne vers Aldric, « Parent de » sens Aldric -> Selyne", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "const-lier");
  const id = Date.now();
  const selyne = `Selyne ${id}`;
  const aldric = `Aldric ${id}`;
  const selyneUrl = await creerEntree(page, worldUrl, selyne);
  await creerEntree(page, worldUrl, aldric);
  await ouvrirConstellation(page, worldUrl, 2);

  const depart = await etoile(page, selyne);
  const arrivee = await etoile(page, aldric);
  await page.keyboard.down("Shift");
  await page.mouse.move(depart.clientX, depart.clientY);
  await page.mouse.down();
  await page.mouse.move(arrivee.clientX, arrivee.clientY, { steps: 15 });
  // Delai de survol de la cible (edgehandles, hoverDelay 150 ms).
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.keyboard.up("Shift");

  const boite = page.getByRole("dialog", { name: "Nouvelle relation", exact: true });
  await expect(boite).toBeVisible();
  await boite.getByLabel("Type de relation", { exact: true }).selectOption({ label: "Parent de" });
  await boite
    .getByRole("radio", { name: `${aldric} — Parent de → ${selyne}`, exact: true })
    .check();
  await boite.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(boite).toBeHidden();

  await page.goto(selyneUrl);
  const section = sectionRelations(page);
  const terme = section.getByRole("term").filter({ hasText: "Enfant de" });
  await expect(terme).toHaveText("Enfant de");
  await expect(
    terme.locator("xpath=..").getByRole("link", { name: aldric, exact: true }),
  ).toBeVisible();
});

test("Reorganiser puis Annuler : les places d'origine reviennent et restent", async ({ page }) => {
  const worldUrl = await inscrireEtCreerMonde(page, "const-reorg");
  const id = Date.now();
  await creerEntree(page, worldUrl, `Selyne ${id}`);
  await creerEntree(page, worldUrl, `Aldric ${id}`);
  await creerEntree(page, worldUrl, `Mira ${id}`);
  await ouvrirConstellation(page, worldUrl, 3);
  const origine = places(await etoiles(page));

  await page.getByRole("button", { name: "Réorganiser automatiquement", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  const reorganisation = attendreSauvegarde(page);
  await confirmation.getByRole("button", { name: "Réorganiser", exact: true }).click();
  await reorganisation;
  await expect(page.getByText("Disposition réorganisée", { exact: true })).toBeVisible();
  // Le bouton « Annuler » de la confirmation reste dans le DOM pendant sa
  // fermeture : on attend qu'elle ait disparu avant celui de la notification.
  await expect(confirmation).toBeHidden();

  const annulation = attendreSauvegarde(page);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await annulation;
  expectMemesPlaces(places(await etoiles(page)), origine);

  await ouvrirConstellation(page, worldUrl, 3);
  expectMemesPlaces(places(await etoiles(page)), origine);
});

test("isoler une entree a 1 saut : seuls elle et ses voisins restent dans la liste, apres rechargement aussi", async ({
  page,
}) => {
  const worldUrl = await inscrireEtCreerMonde(page, "const-isoler");
  const id = Date.now();
  const selyne = `Selyne ${id}`;
  const aldric = `Aldric ${id}`;
  const mira = `Mira ${id}`;
  const selyneUrl = await creerEntree(page, worldUrl, selyne);
  const aldricUrl = await creerEntree(page, worldUrl, aldric);
  await creerEntree(page, worldUrl, mira);
  await declarerRelation(page, selyneUrl, "Parent de", aldric);
  await declarerRelation(page, aldricUrl, "Allié", mira);
  await ouvrirConstellation(page, worldUrl, 3);

  const star = await etoile(page, selyne);
  await page.mouse.click(star.clientX, star.clientY);
  const carte = page.getByRole("region", { name: selyne, exact: true });
  await carte.getByRole("button", { name: "Isoler", exact: true }).click();
  await expect(page.getByText(`Isolé : ${selyne} · 1 saut`, { exact: true })).toBeVisible();

  async function verifierListe() {
    await page.getByRole("button", { name: "Fils", exact: true }).click();
    const liste = page.getByRole("navigation", {
      name: "Liste des liens de la constellation",
      exact: true,
    });
    await expect(liste.getByRole("link", { name: selyne, exact: true })).toBeVisible();
    await expect(
      liste.getByRole("link", { name: `Parent de → ${aldric}`, exact: true }),
    ).toBeVisible();
    await expect(liste.getByText(mira)).toHaveCount(0);
  }
  await verifierListe();

  await ouvrirConstellation(page, worldUrl, 3);
  await expect(page.getByText(`Isolé : ${selyne} · 1 saut`, { exact: true })).toBeVisible();
  await verifierListe();
});

/**
 * Ciel d'histoires (KAN-85, ADR-0033) : arrivee animee, eclairage au survol,
 * reduced-motion et absence de saut a l'hydratation. Etat lu par le crochet
 * de test (opacite effective, attenuation, etat de l'arrivee).
 */
async function mondeATroisEtoiles(page: Page, prefixe: string) {
  const worldUrl = await inscrireEtCreerMonde(page, prefixe);
  const id = Date.now();
  const noms = { a: `Astrid ${id}`, b: `Brann ${id}`, c: `Cael ${id}` };
  const ficheA = await creerEntree(page, worldUrl, noms.a);
  await creerEntree(page, worldUrl, noms.b);
  await creerEntree(page, worldUrl, noms.c);
  await declarerRelation(page, ficheA, "Allié", noms.b);
  return { worldUrl, noms };
}

async function arrivee(page: Page): Promise<string> {
  return page.evaluate(() => window.__storyTideConstellation?.arrival() ?? "absent");
}

test.describe("ciel d'histoires, reduced-motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("a l'arrivee, toutes les etoiles sont visibles immediatement", async ({ page }) => {
    const { worldUrl } = await mondeATroisEtoiles(page, "ciel-calme");

    await page.goto(worldUrl);
    await expect
      .poll(() => page.evaluate(() => window.__storyTideConstellation?.nodes().length ?? 0))
      .toBe(3);
    // Premiere lecture : opacite finale, aucune arrivee jouee.
    const premieres = await etoiles(page);
    expect(premieres.map((star) => star.opacity)).toEqual([1, 1, 1]);
    expect(await arrivee(page)).toBe("done");
  });
});

// Sidebar repliee (stockage vide, defaut de la page du monde) : l'etoile
// visee ne peut pas se trouver sous le panneau en verre de la sidebar.
test.describe("ciel d'histoires, sidebar repliee", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("un clic sur une etoile pendant l'arrivee animee ouvre sa carte", async ({ page }) => {
    const { worldUrl, noms } = await mondeATroisEtoiles(page, "ciel-clic");

    await page.goto(worldUrl);
    await expect
      .poll(() => page.evaluate(() => window.__storyTideConstellation?.nodes().length ?? 0))
      .toBe(3);
    // Positions a l'ecran stables avant tout clic par coordonnees (skill
    // playwright-stable-positions-before-click) ; pas de networkidle ici :
    // l'arrivee (~1 s) serait finie avant le clic.
    await attendrePositionsStables(page);
    // Lecture de l'etat ET clic dans la meme evaluation : le clic part
    // pendant l'arrivee, sans dependre d'un delai entre deux allers-retours.
    const pendantArrivee = await page.evaluate((label) => {
      const hook = window.__storyTideConstellation;
      const star = hook?.nodes().find((node) => node.label === label);
      if (!hook || !star) {
        return "etoile absente";
      }
      const state = hook.arrival();
      const target = document.elementFromPoint(star.clientX, star.clientY);
      for (const type of ["mousedown", "mouseup"]) {
        target?.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: star.clientX,
            clientY: star.clientY,
            button: 0,
          }),
        );
      }
      return state;
    }, noms.c);

    expect(pendantArrivee).toBe("running");
    await expect(page.getByRole("region", { name: noms.c, exact: true })).toBeVisible();
    // L'interaction a termine l'arrivee : ciel entierement allume.
    expect(await arrivee(page)).toBe("done");
    expect((await etoiles(page)).every((star) => star.opacity === 1)).toBe(true);
  });
});

test("survol d'une etoile : ses voisins restent lumineux, une etoile non liee s'attenue", async ({
  page,
}) => {
  const { worldUrl, noms } = await mondeATroisEtoiles(page, "ciel-survol");

  await ouvrirConstellation(page, worldUrl, 3);
  await expect.poll(() => arrivee(page)).toBe("done");
  const a = await etoile(page, noms.a);
  await page.mouse.move(a.clientX, a.clientY);

  await expect
    .poll(async () => {
      const ciel = await etoiles(page);
      const lire = (label: string) => ciel.find((star) => star.label === label);
      return {
        voisin: lire(noms.b)?.dimmed,
        voisinNomme: lire(noms.b)?.named,
        voisinOpacite: lire(noms.b)?.opacity,
        nonLiee: lire(noms.c)?.dimmed,
        nonLieeAttenuee: (lire(noms.c)?.opacity ?? 1) < 1,
      };
    })
    .toEqual({
      voisin: false,
      voisinNomme: true,
      voisinOpacite: 1,
      nonLiee: true,
      nonLieeAttenuee: true,
    });

  // Sortie : tout le ciel revient.
  await page.mouse.move(5, 300);
  await expect
    .poll(async () => (await etoiles(page)).every((star) => !star.dimmed && star.opacity === 1))
    .toBe(true);
});

test("sidebar ouverte en preference : aucune variation de position des etoiles apres hydratation", async ({
  page,
}) => {
  // Preference « sidebar depliee » : cookie pose par playwright.config.ts,
  // lu cote serveur (KAN-85).
  const { worldUrl } = await mondeATroisEtoiles(page, "ciel-sidebar");

  await page.goto(worldUrl);
  await expect(
    page.getByRole("button", { name: "Masquer la liste des entrées", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__storyTideConstellation?.nodes().length ?? 0))
    .toBe(3);
  const premiere = (await etoiles(page)).map(({ id, clientX, clientY }) => ({
    id,
    clientX,
    clientY,
  }));

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const apres = (await etoiles(page)).map(({ id, clientX, clientY }) => ({ id, clientX, clientY }));
  expect(apres).toEqual(premiere);
});

test("contour de focus de la zone : visible au clavier, jamais apres un clic", async ({ page }) => {
  const worldUrl = await inscrireEtCreerMonde(page, "const-focus");
  await creerEntree(page, worldUrl, `Selyne ${Date.now()}`);
  await ouvrirConstellation(page, worldUrl, 1);
  const zone = page.getByRole("group", { name: /^Constellation\./ });
  const contour = () => zone.evaluate((el) => getComputedStyle(el).outlineStyle);

  // Navigation clavier jusqu'a la zone : contour visible.
  for (let i = 0; i < 40; i += 1) {
    if (await zone.evaluate((el) => el === document.activeElement)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(zone).toBeFocused();
  expect(await contour()).not.toBe("none");

  // Clic dans le ciel, sur du fond vide : focus garde, sans contour. Aux
  // trois quarts de la largeur, en bas : hors de la sidebar en verre (bas
  // gauche, depliee par le cookie des e2e), de la fleche du pied de page
  // (centre) et des controles (bas droite).
  const boite = await zone.boundingBox();
  if (!boite) {
    throw new Error("zone invisible");
  }
  await page.mouse.click(boite.x + boite.width * 0.75, boite.y + boite.height - 60);
  await expect(zone).toBeFocused();
  expect(await contour()).toBe("none");
});
