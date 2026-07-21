// Assainissement des URL (OWASP A03) : source unique de verite partagee entre
// la validation serveur du contenu (tiptap-content.ts, assertSafeAttributes ->
// jamais contournable, meme via un appel direct a l'action de sauvegarde) et
// l'assainissement a l'entree cote editeur (tiptap-extensions.ts, SafeLink) -
// KAN-36 bugfix P1 (2026-07-21) : un lien colle depuis Obsidian (wikilink
// converti par le presse-papier en <a href="Cultistes des souterrains" ...> -
// href relatif, avec espaces) passait le parsing Tiptap cote client et
// faisait rejeter TOUT le document par cette meme regle cote serveur, avec
// un message generique ("Contenu invalide.") sans rapport avec la cause
// reelle. Deplacee ici (hors tiptap-content.ts) pour eviter un cycle d'import :
// tiptap-content.ts importe deja createEditorExtensions depuis
// tiptap-extensions.ts.
const MAX_URL_LENGTH = 2048;

// Node.fromJSON + check() valident la STRUCTURE (types de nodes/marks connus,
// nesting conforme au schema) mais jamais les VALEURS d'attributs : un doc
// structurellement valide peut quand meme porter un `image.src` ou un
// `link.href` en `javascript:`/`data:`/relatif (XSS ou rejet en cascade) - le
// schema ne le sait pas.
export function isSafeHttpUrl(value: unknown): value is string {
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
