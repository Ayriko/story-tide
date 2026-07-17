import type { Extensions } from "@tiptap/core";
import { Mention } from "@tiptap/extension-mention";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { MENTION_CLASS_NAME, MENTION_TARGET_ATTR } from "./tiptap-mention-attrs";

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
    // Mentions manuelles @ (KAN-22) : node atome, jamais du texte editable -
    // memes classe/attribut DOM que le surlignage live (tiptap-mention-attrs.ts)
    // pour reutiliser le meme gestionnaire Ctrl/Cmd+clic (entity-editor.tsx)
    // sans dupliquer de logique de navigation.
    //
    // renderText retourne volontairement une chaine vide : le comportement par
    // defaut ("@Label") serait inclus par extractPlainText (generateText invoque
    // le renderText de chaque node atome), et un nom d'entite mentionne
    // reapparaitrait alors dans le plainText scanne par le worker AUTO
    // (scanAndLinkEntity) - la mention manuelle se re-matcherait elle-meme comme
    // une (fausse) nouvelle occurrence AUTO. Le surlignage live cote client
    // (buildTextWithPositions, tiptap-positions.ts) ignore deja nativement les
    // nodes non textuels ; renderText: () => "" aligne extractPlainText sur le
    // meme comportement plutot que de laisser les deux mecanismes diverger.
    //
    // Suggestion (popup @, items/render) intentionnellement non configuree ici :
    // ce fichier ne fixe que le SCHEMA (partage serveur/client, cf.
    // tiptap-content.ts) - le rendu interactif de la suggestion est ajoute par
    // l'editeur client (entity-editor.tsx), pas par cette fabrique partagee.
    Mention.configure({
      HTMLAttributes: { class: MENTION_CLASS_NAME },
      renderText: () => "",
      renderHTML: ({ options, node }) => [
        "span",
        { ...options.HTMLAttributes, [MENTION_TARGET_ATTR]: node.attrs.id },
        `@${node.attrs.label ?? node.attrs.id}`,
      ],
    }),
  ];
}
