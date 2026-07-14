import { generateText, getSchema, type JSONContent } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { createEditorExtensions } from "./tiptap-extensions";

// Cote serveur, pas de cycle de vie d'Editor (pas de montage/demontage React) -
// construire les extensions et le schema une seule fois au chargement du
// module est sur et evite un cout de reconstruction a chaque requete.
const extensions = createEditorExtensions();
const schema = getSchema(extensions);

export class InvalidContentError extends Error {
  constructor() {
    super("Contenu invalide.");
    this.name = "InvalidContentError";
  }
}

// Un doc ProseMirror vide au sens strict ({ type: "doc", content: [] }) est
// invalide : le node "doc" exige au moins un bloc (content match "block+").
// Un paragraphe vide est le contenu minimal valide - c'est aussi ce que
// produit l'editeur Tiptap reel quand on l'initialise sans contenu.
export const EMPTY_CONTENT: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

// Valide un JSON quelconque contre le schema strict de l'editeur (OWASP A03) :
// rejette tout node/mark hors allowlist (ex. codeBlock desactive) et toute
// structure malformee, meme si la requete ne passe pas par l'editeur reel
// (Node.fromJSON leve si un type de node/mark est inconnu du schema ; check()
// verifie en plus l'integrite structurelle du document construit).
//
// Retourne le CONTENU D'ORIGINE (deja plain JSON - venu de Postgres ou de
// JSON.parse d'une chaine cote action), jamais doc.toJSON() : la
// representation interne de ProseMirror pour les attrs n'est pas un objet
// "plain" au sens strict de React ("Only plain objects... Classes or null
// prototypes are not supported"), ce qui casse la frontiere Server → Client
// Component quand ce contenu est repasse en prop a un composant client (page
// d'une fiche qui recharge son contenu). fromJSON+check() suffit a valider ;
// pas besoin de la forme re-derivee pour la valeur qu'on retourne.
export function parseContent(content: unknown): JSONContent {
  try {
    const doc = ProseMirrorNode.fromJSON(schema, content);
    doc.check();
  } catch (error) {
    // Ne jamais avaler la raison reelle : sans ce log, un rejet de contenu
    // legitime (bug de config du schema) est indiscernable d'un vrai contenu
    // malveillant - vecu en debug (cf. dev-log), corrige ici.
    console.error("[tiptap-content] Contenu rejete par le schema ProseMirror :", error);
    throw new InvalidContentError();
  }
  return content as JSONContent;
}

// Extraction du texte brut (pour le futur scan de liaison + la recherche) -
// fonction pure, ne necessite pas de DOM/navigateur reel.
export function extractPlainText(content: JSONContent): string {
  return generateText(content, extensions);
}
