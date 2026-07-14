// Normalise une chaine pour le matching du moteur de liaison (Aho-Corasick) :
// casse repliee + accents retires, transformation strictement caractere a
// caractere (aucun ajout/suppression de caractere hors marques combinantes) -
// necessaire pour que les positions calculees par l'automate restent alignees
// avec le `plainText` d'origine (surlignage cote client, decorations
// ProseMirror). Meme technique que src/lib/slugify.ts (NFD + retrait de
// \p{M}), sans le remplacement non-alphanumerique -> tiret : ici on ne change
// jamais les espaces/ponctuation, seulement la casse et les diacritiques.
//
// NFD (canonique), jamais NFKD (compatibilite) : NFD decompose les accents
// (e.g. "e" + accent aigu) mais ne deplie PAS les ligatures "œ"/"æ" (elles
// n'ont pas de decomposition canonique). C'est la decision actee dans
// ADR-0001 - depliers les ligatures changerait la longueur de la chaine et
// casserait l'alignement caractere-exact des positions de surlignage.
export function normalizeForMatch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}
