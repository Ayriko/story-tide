// Page racine d'un monde (KAN-87) : la Constellation en plein cadre. EGALITE
// EXACTE sur /worlds/<slug> (slash final tolere), jamais un « commence par » :
// fiches, parametres et toute sous-page gardent la coquille normale.
export function isWorldRootPath(pathname: string, worldSlug: string): boolean {
  const root = `/worlds/${worldSlug}`;
  return pathname === root || pathname === `${root}/`;
}
