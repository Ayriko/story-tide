import { generateText, getSchema, type JSONContent } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { createEditorExtensions } from "./tiptap-extensions";
import { isSafeHttpUrl } from "./url-safety";

// Cote serveur, pas de cycle de vie d'Editor (pas de montage/demontage React) -
// construire les extensions et le schema une seule fois au chargement du
// module est sur et evite un cout de reconstruction a chaque requete.
const extensions = createEditorExtensions();
const schema = getSchema(extensions);

export class InvalidContentError extends Error {
  // cause chaine toujours la raison reelle du rejet (erreur ProseMirror ou
  // violation d'attribut) - un message generique ne doit jamais effacer la
  // trace du pourquoi (cf. CLAUDE.md, regle "jamais d'erreur avalee").
  constructor(cause?: unknown) {
    super("Contenu invalide.", { cause });
    this.name = "InvalidContentError";
  }
}

// Un doc ProseMirror vide au sens strict ({ type: "doc", content: [] }) est
// invalide : le node "doc" exige au moins un bloc (content match "block+").
// Un paragraphe vide est le contenu minimal valide - c'est aussi ce que
// produit l'editeur Tiptap reel quand on l'initialise sans contenu.
export const EMPTY_CONTENT: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

// Parcourt le doc deja valide structurellement et rejette la premiere valeur
// d'attribut dangereuse rencontree : image.src/alt/width, puis link.href sur
// les marks, puis mention.id. `alt` est deja exige cote UI (RGAA) - sans ce
// controle serveur, la regle est contournable par un appel direct a l'action
// de sauvegarde.
function assertSafeAttributes(doc: ProseMirrorNode): void {
  let violation: string | null = null;

  doc.descendants((node) => {
    if (violation) {
      return false;
    }
    if (node.type.name === "image") {
      const { src, alt, width } = node.attrs as { src: unknown; alt: unknown; width: unknown };
      if (!isSafeHttpUrl(src)) {
        violation = `image.src invalide : ${JSON.stringify(src)}`;
      } else if (typeof alt !== "string" || alt.trim() === "") {
        violation = "image.alt manquant";
      } else if (
        typeof width !== "number" ||
        !Number.isFinite(width) ||
        width < 10 ||
        width > 100
      ) {
        // width (KAN-39 volet 5) : pourcentage de la largeur du contenu,
        // jamais persiste hors [10..100] - une image sans cet attribut du
        // tout (contenu persiste avant ce volet) obtient 100 via le defaut
        // du schema (Node.fromJSON), jamais "absent" a ce stade.
        violation = `image.width invalide : ${JSON.stringify(width)}`;
      }
    }
    if (node.type.name === "mention") {
      // Verifie uniquement la FORME de l'attribut (chaine non vide) : ce
      // module est pur (aucun acces DB), l'existence/l'appartenance reelle de
      // l'entite au monde est verifiee plus tard par le service qui
      // reconcilie les Relation origin=MANUAL (autorisation, pas parsing).
      const { id } = node.attrs as { id: unknown };
      if (typeof id !== "string" || id.trim() === "") {
        violation = `mention.id invalide : ${JSON.stringify(id)}`;
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
    throw new InvalidContentError(violation);
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
    throw new InvalidContentError(error);
  }
  assertSafeAttributes(doc);
  return content as JSONContent;
}

// Extraction du texte brut (pour le futur scan de liaison + la recherche) -
// fonction pure, ne necessite pas de DOM/navigateur reel.
export function extractPlainText(content: JSONContent): string {
  return generateText(content, extensions);
}

// Extrait les id d'entites mentionnees manuellement (@, KAN-22) - parcours du
// JSON brut deja valide (pas besoin de reconstruire un Node ProseMirror : la
// structure { type, attrs?, content? } se parcourt directement). Utilise par
// saveEntityContentAction pour reconcilier les Relation origin=MANUAL -
// jamais de confiance aveugle dans ces id cote service (reconcileManualMentions
// revalide leur appartenance au monde avant toute ecriture, OWASP A01).
export function extractMentionedEntityIds(content: JSONContent): string[] {
  const ids = new Set<string>();

  function walk(node: JSONContent): void {
    if (node.type === "mention" && typeof node.attrs?.id === "string" && node.attrs.id !== "") {
      ids.add(node.attrs.id);
    }
    node.content?.forEach(walk);
  }

  walk(content);
  return [...ids];
}
