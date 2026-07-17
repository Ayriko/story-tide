import type { Extensions } from "@tiptap/core";
import { Mention } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { normalizeForMatch } from "./linker/normalize";
import { MENTION_CLASS_NAME, MENTION_TARGET_ATTR } from "./tiptap-mention-attrs";

// Forme volontairement alignee sur MentionNodeAttrs (id/label) : c'est aussi
// l'objet que la commande d'insertion (ci-dessous) recoit tel quel a
// l'execution (le typage TSelected de @tiptap/suggestion reste `any` en
// pratique, donc rien ne force cette coherence a la compilation - la garder
// volontairement identique evite un decalage runtime silencieux entre ce que
// `items()` retourne et ce que `command` lit).
export interface MentionSuggestionItem {
  id: string;
  label: string;
}

const MAX_MENTION_SUGGESTIONS = 8;

// Filtre pur (teste isolement, aucune dependance DOM/React) : substring
// insensible casse/accents, meme normalisation que le moteur de liaison
// (normalizeForMatch) - coherent avec ce qui est deja surligne live.
export function filterMentionSuggestions(
  entities: MentionSuggestionItem[],
  query: string,
): MentionSuggestionItem[] {
  const normalizedQuery = normalizeForMatch(query.trim());
  const matches =
    normalizedQuery === ""
      ? entities
      : entities.filter((entity) => normalizeForMatch(entity.label).includes(normalizedQuery));
  return matches.slice(0, MAX_MENTION_SUGGESTIONS);
}

// Seuls items/render varient par instance d'editeur (liste d'entites du
// monde + rendu de la popup, cf. entity-editor.tsx) - command reste partagee
// (insertion generique), configuree une seule fois ci-dessous.
export type MentionSuggestionConfig = Pick<
  SuggestionOptions<MentionSuggestionItem>,
  "items" | "render"
>;

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
export function createEditorExtensions(mentionSuggestion?: MentionSuggestionConfig): Extensions {
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
    // suggestion.items/render : fournis par l'appelant (entity-editor.tsx,
    // liste d'entites du monde + popup React) - absents cote serveur
    // (tiptap-content.ts appelle sans argument), sans consequence : ce fichier
    // ne fixe que le SCHEMA, addProseMirrorPlugins() (qui lirait items/render)
    // n'est jamais invoque par getSchema().
    Mention.configure({
      HTMLAttributes: { class: MENTION_CLASS_NAME },
      renderText: () => "",
      // Pas de prefixe "@" affiche : c'est un declencheur de saisie, pas une
      // partie du texte - le rendu reste ainsi visuellement identique au
      // surlignage AUTO (qui n'ajoute jamais de caractere), cf. retour
      // utilisateur session 2026-07-17.
      renderHTML: ({ options, node }) => [
        "span",
        { ...options.HTMLAttributes, [MENTION_TARGET_ATTR]: node.attrs.id },
        `${node.attrs.label ?? node.attrs.id}`,
      ],
      suggestion: {
        char: "@",
        // La plupart des noms d'entites contiennent des espaces ("Aldric le
        // Vaillant") - sans allowSpaces, @tiptap/suggestion ferme la
        // suggestion des le premier espace tape (son regex de requete exclut
        // \s par defaut), rendant impossible d'affiner une recherche sur un
        // nom compose. Trouve via le test e2e (manual-mention.spec.ts), pas
        // reproduit manuellement (selection faite sans taper d'espace).
        allowSpaces: true,
        // Insertion generique, partagee entre tous les appelants : un espace
        // suit toujours la mention pour que le curseur ne reste jamais
        // "coince" contre le node atome (convention Tiptap standard).
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "mention", attrs: { id: props.id, label: props.label } },
              { type: "text", text: " " },
            ])
            .run();
        },
        ...mentionSuggestion,
      },
    }),
  ];
}
