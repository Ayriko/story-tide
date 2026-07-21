// Normalisation du collage (KAN-39 volet 2, 2026-07-21) : un <p> contenant des
// <br> (retour a la ligne "souple", produit par de nombreux exports HTML -
// Obsidian, Notion, Word...) doit devenir PLUSIEURS paragraphes ProseMirror
// distincts, pas un seul paragraphe avec un saut de ligne a l'interieur (que
// le schema de l'editeur ne modelise pas comme tel - seul `hardBreak` existe
// via StarterKit, jamais insere au collage ici). Sans cette normalisation, un
// "Sous-titre" tape sur sa propre ligne dans l'outil source se retrouve fondu
// dans le paragraphe qui suit des le collage.
//
// DOMParser (pas de regex sur du HTML) : les nœuds entre deux <br> sont
// DEPLACES (pas clones) vers un nouveau <p>, ce qui preserve integralement
// les marks inline (gras/italique/lien...) qui ne traversent PAS un <br> - cas
// tres majoritaire pour ce genre d'export. Un mark inline qui engloberait un
// <br> en son sein (rare) n'est pas couvert : ce cas nécessiterait de couper
// l'element inline lui-meme en deux, hors perimetre des cas requis ici.
//
// Regle unique pour les groupes vides (au lieu d'un cas particulier par
// situation) : un groupe de nœuds vide entre deux <br> (ou en tete/fin de
// bloc) ne produit AUCUN paragraphe - couvre a la fois les <br> consecutifs
// et un <br> final sans creer de paragraphe vide.
export function splitParagraphsOnBreaks(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");

  for (const paragraph of Array.from(parsed.body.querySelectorAll("p"))) {
    if (!paragraph.querySelector("br")) {
      continue;
    }

    // currentGroup en variable locale plutot qu'un dernier element de groups
    // relu par index : sous noUncheckedIndexedAccess, un acces indexe serait
    // typé `ChildNode[] | undefined` meme juste apres une initialisation
    // connue non vide - une variable simple evite l'assertion non-null.
    const groups: ChildNode[][] = [];
    let currentGroup: ChildNode[] = [];
    for (const child of Array.from(paragraph.childNodes)) {
      if (child.nodeName === "BR") {
        groups.push(currentGroup);
        currentGroup = [];
        continue;
      }
      currentGroup.push(child);
    }
    groups.push(currentGroup);

    const newParagraphs = groups
      .filter((group) => group.length > 0)
      .map((group) => {
        const newParagraph = parsed.createElement("p");
        group.forEach((node) => newParagraph.appendChild(node));
        return newParagraph;
      });

    newParagraphs.forEach((newParagraph) => paragraph.before(newParagraph));
    paragraph.remove();
  }

  return parsed.body.innerHTML;
}
