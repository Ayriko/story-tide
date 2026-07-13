// Derive un slug URL-safe a partir d'un nom libre : minuscules, accents retires,
// tout ce qui n'est pas alphanumerique devient un tiret unique, tirets de bord
// coupes. Fonction pure, testable isolement (dictionnaire de World.slug).
export function slugify(input: string): string {
  const slug = input
    .normalize("NFD")
    // Retire les marques combinantes (accents) une fois la forme decomposee (NFD).
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Repli si le nom ne contient aucun caractere alphanumerique (ex: "!!!").
  return slug === "" ? "monde" : slug;
}
