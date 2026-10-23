// Libelle du nombre de relations declarees d'un type (KAN-84, parametres).
export function relationCountLabel(count: number): string {
  if (count === 0) {
    return "aucune relation";
  }
  return `${count} ${count === 1 ? "relation" : "relations"}`;
}
