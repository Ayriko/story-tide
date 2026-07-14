import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

// Schema strict (allowlist - OWASP A03) : uniquement les nodes/marks prevus
// par la spec (titres, listes, gras/italique, citations, liens, images).
// Code/codeBlock/horizontalRule/strike/underline explicitement desactives -
// ils existent dans StarterKit mais ne font pas partie du perimetre retenu.
//
// Fabrique (pas un tableau singleton) : chaque appel cree de NOUVELLES
// instances d'extension. Necessaire cote client - Tiptap+React ne supporte
// pas de partager les memes instances d'extension entre plusieurs cycles de
// vie d'Editor (piege reel rencontre : sous React StrictMode, qui monte/
// demonte/remonte chaque composant une fois en dev, reutiliser un tableau
// d'extensions deja liees a un premier Editor detruit corrompt les commandes
// dependant du schema - seuls les marks simples comme gras/italique
// survivaient, titres/listes/citation/lien/image non). Utilisee a la fois
// cote client (editeur reel) et cote serveur (validation + extraction
// plainText) : meme configuration des deux cotes, jamais de derive.
export function createEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] }, // pas de H1 : reserve au titre de page (nom de la fiche)
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https"], // jamais javascript:/data: (OWASP A03)
      },
    }),
    Image,
  ];
}
