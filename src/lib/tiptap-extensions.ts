import type { Extensions, NodeViewRenderer } from "@tiptap/core";
import { Mention } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import Image, { type ImageOptions } from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { normalizeForMatch } from "./linker/normalize";
import { MENTION_CLASS_NAME, MENTION_TARGET_ATTR } from "./tiptap-mention-attrs";
import { isSafeHttpUrl } from "./url-safety";

// SafeLink (KAN-36 bugfix P1, 2026-07-21) : assainit les liens des le parsing
// (frappe/collage) plutot que de laisser une mark invalide atteindre le
// serveur, qui rejetterait alors TOUT le document (isSafeHttpUrl,
// url-safety.ts). Reproduit avec un lien Obsidian colle (wikilink converti en
// <a href="Cultistes des souterrains" ...> - href relatif avec espaces) :
// Tiptap parsait la mark, le JSON partait avec cet attribut, et
// assertSafeAttributes() (tiptap-content.ts) rejetait le document entier avec
// "Contenu invalide." alors que retaper le meme texte au clavier fonctionnait.
// La validation serveur ne change pas (garde-fou non contournable, OWASP
// A03) - on evite juste de lui presenter un contenu qu'elle rejettera de
// toute facon : rejeter UN ATTRIBUT qu'on peut jeter (le lien) est
// disproportionne face a rejeter tout le document, donc on retire le lien et
// on garde le texte.
//
// getAttrs => false (ProseMirror pur, independant de la version de Tiptap) :
// la regle "a[href]" ne matche pas, aucune mark n'est creee, le texte de
// l'ancre reste. Le parseHTML natif de @tiptap/extension-link delegue deja a
// isAllowedUri (verifie dans node_modules 3.27.4) mais rien ne garantit que
// ce reste vrai a une prochaine montee de version - cet override est une
// seconde barriere volontairement redondante, pas une simplification a
// supprimer.
//
// Blueprint au niveau module (comme Image/Mention importes), jamais configure
// ICI : SafeLink.configure(...) est appele DANS createEditorExtensions(),
// meme regle que le reste de ce fichier (StrictMode - un Link deja configure
// et partage entre plusieurs montages d'Editor corrompt les commandes liees
// au schema, "link" etant explicitement l'une des marks qui n'y survivait
// pas).
const SafeLink = Link.extend({
  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (element) => {
          const href = (element as HTMLElement).getAttribute("href");
          return href && isSafeHttpUrl(href) ? null : false;
        },
      },
    ];
  },
});

// ResizableImage (KAN-39 volet 5) : ajoute l'attribut `width` - POURCENTAGE de
// la largeur du contenu (jamais des pixels, la mise en page reste fluide),
// borne [10..100], defaut 100. Retrocompat : une image persistee avant ce
// volet n'a pas cet attribut du tout - Node.fromJSON (ProseMirror) applique
// le defaut du schema pour tout attribut absent, `width` devient 100 au
// chargement sans migration.
//
// Le NodeView React (poignee de drag) n'est PAS defini ici : ce fichier est
// importe a la fois cote serveur (tiptap-content.ts, validation - jamais de
// vue montee) et cote client (entity-editor.tsx, editeur reel) - tirer
// @tiptap/react/JSX ici entrainerait ce paquet dans le bundle serveur pour
// rien. addNodeView() retourne `this.options.nodeViewRenderer`, fourni
// UNIQUEMENT par l'appelant client via createEditorExtensions(...,
// {imageNodeView}) ci-dessous ; `null` cote serveur (comportement par defaut
// Tiptap, jamais invoque de toute facon la ou aucun Editor n'est monte).
//
// Blueprint au niveau module (comme SafeLink/Image importes), jamais
// configure ICI - ResizableImage.configure(...) est appele DANS
// createEditorExtensions(), meme invariant StrictMode que le reste de ce
// fichier.
const ResizableImage = Image.extend<ImageOptions & { nodeViewRenderer?: NodeViewRenderer }>({
  addOptions() {
    // Repli explicite (jamais reellement utilise a l'execution - this.parent
    // est toujours defini pour un .extend(), mais typé "possiblement
    // undefined" par Tiptap) : reprend les defauts documentes de Image
    // (node_modules/@tiptap/extension-image/dist/index.js) plutot qu'un cast
    // `as ImageOptions` de complaisance.
    const parentOptions = this.parent?.() ?? {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
      resize: false as const,
    };
    return {
      ...parentOptions,
      nodeViewRenderer: undefined,
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (element) => {
          const match = /^(\d+(?:\.\d+)?)%$/.exec((element as HTMLElement).style.width);
          return match ? Number(match[1]) : 100;
        },
        renderHTML: (attributes: { width?: unknown }) => ({
          style: `width: ${typeof attributes.width === "number" ? attributes.width : 100}%`,
        }),
      },
    };
  },
  addNodeView() {
    return this.options.nodeViewRenderer ?? null;
  },
});

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
export function createEditorExtensions(
  mentionSuggestion?: MentionSuggestionConfig,
  // imageNodeView (KAN-39 volet 5) : fourni uniquement cote client
  // (entity-editor.tsx, via ReactNodeViewRenderer) - voir le commentaire de
  // ResizableImage ci-dessus pour la raison du layering.
  options?: { imageNodeView?: NodeViewRenderer },
): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] }, // pas de H1 : reserve au titre de page (nom de la fiche)
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      // link: false (KAN-36 bugfix P1) : SafeLink (ci-dessus) remplace le
      // Link embarque par StarterKit - le laisser actif enregistrerait DEUX
      // marks "link" concurrentes (StarterKit importe et pousse sa propre
      // instance de @tiptap/extension-link des que `link !== false`, verifie
      // dans node_modules/@tiptap/starter-kit/dist/index.js), la premiere
      // l'emportant au parsing et rendant SafeLink sans effet.
      link: false,
    }),
    // SafeLink (KAN-36 bugfix P1) : options reprises telles quelles de
    // l'ancienne config StarterKit.link ci-dessus, + isAllowedUri qui
    // gouverne l'autolink/setLink/toggleLink ET (verifie dans le parseHTML
    // par defaut de @tiptap/extension-link) le paste-parsing natif - ceinture
    // et bretelles avec l'override parseHTML de SafeLink.
    SafeLink.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      protocols: ["http", "https"], // jamais javascript:/data: (OWASP A03)
      isAllowedUri: (url, ctx) => ctx.defaultValidate(url) && isSafeHttpUrl(url),
    }),
    // loading="lazy" (KAN-16, demande du brief) : les images ne se chargent
    // qu'a l'approche du viewport, pas au montage complet du document.
    // nodeViewRenderer : cf. commentaire de ResizableImage plus haut.
    ResizableImage.configure({
      HTMLAttributes: { loading: "lazy" },
      nodeViewRenderer: options?.imageNodeView,
    }),
    // Placeholder (KAN-36 P4) : purement presentationnel - ajoute une
    // decoration ProseMirror sur le premier noeud vide (attribut
    // data-placeholder + classe is-editor-empty, stylees en CSS cote
    // entity-editor.tsx), n'introduit aucun node/mark et ne touche donc pas
    // au schema valide cote serveur (getSchema(), tiptap-content.ts).
    Placeholder.configure({ placeholder: "Commencez à écrire…" }),
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
