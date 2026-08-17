import { test, expect, type Page } from "@playwright/test";

/**
 * Non-regression BUG-014 (KAN-53) : le trou de couverture de KAN-45.
 *
 * KAN-45 a deplace le conteneur defilant au-dessus de <main> pour que <footer>
 * reste un landmark "contentinfo" de premier niveau. Ce nouveau patron n'avait
 * ete exerce que sur des pages COURTES (smoke). Des que le contenu d'une entree
 * depassait le viewport, le <span class="sr-only"> du lien externe du pied de
 * page (sr-only vaut position:absolute) se rattachait au shell h-dvh faute de
 * "relative" sur le conteneur defilant, s'en echappait, et rendait le shell
 * lui-meme defilable. Le scrollIntoView du caret faisait alors glisser tout le
 * shell d'un ecran entier, sans retour possible : "bloc" en bas d'ecran, texte
 * saisi hors de vue, zone morte sous le pied de page - trois symptomes pour ce
 * seul defaut.
 *
 * L'invariant teste ici est volontairement formule sans dependre d'une classe
 * Tailwind : DANS UNE PAGE, UN SEUL ELEMENT DEFILE, celui marque
 * data-scroll-container. Tout ancetre qui defile est le bug.
 */

const MOT_DE_PASSE = "long-content-motdepasse-1234";

async function inscrire(page: Page, prefixe: string) {
  await page.goto("/register");
  await page.getByLabel("Nom", { exact: true }).fill("Testeur contenu long");
  await page.getByLabel("E-mail").fill(`${prefixe}-${Date.now()}@story-tide.test`);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByLabel(/Ne pas créer le monde d'exemple/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/worlds");
}

async function creerMondeEtEntree(page: Page, monde: string, entree: string) {
  await page.getByRole("button", { name: "+ Nouveau monde" }).click();
  await page.getByLabel("Nom du monde").fill(monde);
  await page.getByRole("button", { name: "Créer le monde" }).click();
  await page.waitForURL(/\/worlds\/[^/]+$/);

  await page.getByTestId("create-entity-trigger").click();
  await page.getByLabel("Nom", { exact: true }).fill(entree);
  await page.getByTestId("create-entity-submit").click();
  await page.waitForURL(/\/worlds\/[^/]+\/entities\/[^/]+$/);
}

/** scrollTop de chaque ancetre du conteneur defilant, du plus proche au <html>. */
async function ancetresQuiDefilent(page: Page) {
  return page.evaluate(() => {
    const scroller = document.querySelector("[data-scroll-container]");
    if (!scroller) throw new Error("Aucun [data-scroll-container] dans la page");
    const coupables: Array<{ classe: string; scrollTop: number }> = [];
    let noeud = scroller.parentElement;
    while (noeud) {
      if (noeud.scrollTop !== 0) {
        coupables.push({ classe: noeud.className.toString(), scrollTop: noeud.scrollTop });
      }
      noeud = noeud.parentElement;
    }
    return coupables;
  });
}

test("une entree dont le contenu depasse le viewport reste entierement utilisable", async ({
  page,
}) => {
  await inscrire(page, "long-content");
  await creerMondeEtEntree(page, `Monde long ${Date.now()}`, "Fiche longue");

  const editeur = page.locator(".ProseMirror");
  await editeur.click();

  // Contenu largement superieur a la hauteur de l'ecran (le cas jamais exerce).
  // Lignes volontairement courtes : c'est le NOMBRE de paragraphes qui fait la
  // hauteur, et chaque caractere tape coute du temps de test.
  const lignes = Array.from({ length: 45 }, (_, i) => `Ligne ${i + 1}.`);
  await page.keyboard.type(lignes.join("\n"), { delay: 0 });
  await expect(page.getByText("Enregistré.")).toBeVisible({ timeout: 10_000 });

  // Garde-fou : si le contenu ne depassait pas le viewport, tout le reste du
  // test passerait sans rien prouver.
  const debordeVraiment = await page.evaluate(() => {
    const scroller = document.querySelector("[data-scroll-container]") as HTMLElement;
    return scroller.scrollHeight > scroller.clientHeight * 1.5;
  });
  expect(debordeVraiment).toBe(true);

  // 1. Le defaut lui-meme : aucun ancetre du conteneur defilant ne doit avoir
  //    defile. C'est le glissement du shell qui produisait les trois symptomes.
  expect(await ancetresQuiDefilent(page)).toEqual([]);

  // 2. Le shell ne doit meme pas etre defilable (scrollHeight == clientHeight) :
  //    tant qu'un descendant absolute s'en echappe, il le redeviendrait.
  const shellDefilable = await page.evaluate(() => {
    const scroller = document.querySelector("[data-scroll-container]") as HTMLElement;
    let noeud = scroller.parentElement;
    while (noeud) {
      if (noeud.scrollHeight > noeud.clientHeight + 1) {
        return {
          classe: noeud.className.toString(),
          scrollHeight: noeud.scrollHeight,
          clientHeight: noeud.clientHeight,
        };
      }
      noeud = noeud.parentElement;
    }
    return null;
  });
  expect(shellDefilable).toBeNull();

  // 3. Le caret reste dans la zone visible du conteneur defilant : le texte
  //    saisi ne part pas hors de vue (symptome 2).
  const caretVisible = await page.evaluate(() => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const caret = selection.getRangeAt(0).getBoundingClientRect();
    const scroller = (
      document.querySelector("[data-scroll-container]") as HTMLElement
    ).getBoundingClientRect();
    return caret.top >= scroller.top - 1 && caret.bottom <= scroller.bottom + 1;
  });
  expect(caretVisible).toBe(true);

  // 4. Le titre de la fiche reste atteignable en remontant (symptome 1 : l'en-tete
  //    devenait inaccessible une fois le shell glisse).
  await page.evaluate(() => {
    (document.querySelector("[data-scroll-container]") as HTMLElement).scrollTop = 0;
  });
  await expect(page.getByRole("heading", { name: "Fiche longue" })).toBeInViewport();
  await expect(page.getByRole("toolbar", { name: "Mise en forme" })).toBeInViewport();

  // 5. En bas de course, le pied de page est visible et RIEN ne subsiste sous lui :
  //    plus de zone morte de la hauteur d'un ecran (symptome 3).
  await page.evaluate(() => {
    const scroller = document.querySelector("[data-scroll-container]") as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await expect(page.locator("#site-footer")).toBeInViewport();

  const videSousLePied = await page.evaluate(() => {
    const scroller = document.querySelector("[data-scroll-container]") as HTMLElement;
    const pied = document.querySelector("#site-footer") as HTMLElement;
    return Math.round(
      scroller.getBoundingClientRect().bottom - pied.getBoundingClientRect().bottom,
    );
  });
  expect(videSousLePied).toBeLessThanOrEqual(1);
});

test("une page courte garde le pied de page hors du premier ecran (acquis KAN-45)", async ({
  page,
}) => {
  await inscrire(page, "short-content");

  // /worlds : page courte, carte centree. Le pied de page ne doit pas s'inviter
  // au premier ecran - c'est le comportement voulu par KAN-45, que le correctif
  // de BUG-014 ne doit pas defaire.
  await expect(page.getByRole("heading", { name: "Mes mondes" })).toBeVisible();
  await expect(page.locator("#site-footer")).not.toBeInViewport();
  expect(await ancetresQuiDefilent(page)).toEqual([]);

  // Le chevron le rend atteignable, et le landmark contentinfo est preserve.
  await page.getByRole("button", { name: "Aller au pied de page" }).click();
  await expect(page.locator("#site-footer")).toBeInViewport();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
