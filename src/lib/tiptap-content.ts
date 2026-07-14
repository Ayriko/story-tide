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

const MAX_URL_LENGTH = 2048;

// Node.fromJSON + check() valident la STRUCTURE (types de nodes/marks connus,
// nesting conforme au schema) mais jamais les VALEURS d'attributs : un doc
// structurellement valide peut quand meme porter un `image.src` ou un
// `link.href` en `javascript:`/`data:` (XSS) - le schema ne le sait pas, seul
// `protocols: ["http","https"]` cote config client l'empeche, ce qui ne
// protege pas un appel serveur direct (OWASP A03).
function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Parcourt le doc deja valide structurellement et rejette la premiere valeur
// d'attribut dangereuse rencontree : image.src/alt, puis link.href sur les
// marks. `alt` est deja exige cote UI (RGAA) - sans ce controle serveur, la
// regle est contournable par un appel direct a l'action de sauvegarde.
function assertSafeAttributes(doc: ProseMirrorNode): void {
  let violation: string | null = null;

  doc.descendants((node) => {
    if (violation) {
      return false;
    }
    if (node.type.name === "image") {
      const { src, alt } = node.attrs as { src: unknown; alt: unknown };
      if (!isSafeHttpUrl(src)) {
        violation = `image.src invalide : ${JSON.stringify(src)}`;
      } else if (typeof alt !== "string" || alt.trim() === "") {
        violation = "image.alt manquant";
      }
    }
    node.marks.forEach((mark) => {
      if (!violation && mark.type.name === "link" && !isSafeHttpUrl(mark.attrs.href)) {
        violation = `link.href invalide : ${JSON.stringify(mark.attrs.href)}`;
      }
    });
    return !violation;
  });

  if (violation) {
    console.error("[tiptap-content] Attribut de contenu rejete :", violation);
    throw new InvalidContentError();
  }
}

// Valide un JSON quelconque contre le schema strict de l'editeur (OWASP A03) :
// rejette tout node/mark hors allowlist (ex. codeBlock desactive), toute
// structure malformee, et toute valeur d'attribut dangereuse (src/href non
// http(s), alt manquant) - meme si la requete ne passe pas par l'editeur reel
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
  let doc: ProseMirrorNode;
  try {
    doc = ProseMirrorNode.fromJSON(schema, content);
    doc.check();
  } catch (error) {
    // Ne jamais avaler la raison reelle : sans ce log, un rejet de contenu
    // legitime (bug de config du schema) est indiscernable d'un vrai contenu
    // malveillant - vecu en debug (cf. dev-log), corrige ici.
    console.error("[tiptap-content] Contenu rejete par le schema ProseMirror :", error);
    throw new InvalidContentError();
  }
  assertSafeAttributes(doc);
  return content as JSONContent;
}

// Extraction du texte brut (pour le futur scan de liaison + la recherche) -
// fonction pure, ne necessite pas de DOM/navigateur reel.
export function extractPlainText(content: JSONContent): string {
  return generateText(content, extensions);
}
