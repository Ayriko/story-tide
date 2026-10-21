// Libelle du nombre d'entrees d'un type (KAN-81, page de parametres).
export function entryCountLabel(count: number): string {
  if (count === 0) {
    return "aucune entrée";
  }
  return `${count} ${count === 1 ? "entrée" : "entrées"}`;
}
