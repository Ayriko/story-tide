import type { ReactNode } from "react";

// Structure commune de barre haute (KAN-36 P1-bis, point 1) - deux call-sites
// l'utilisent avec des props differentes (pas de logique dupliquee) :
// worlds/page.tsx (hors monde : "Story Tide" + horloge + menu utilisateur,
// pas de nav pilule) et worlds/[slug]/layout.tsx (dans un monde : nom du
// monde + nav pilule + horloge, PAS de menu utilisateur - il reste en bas de
// la sidebar, jamais duplique). (app)/layout.tsx (le vrai layout racine
// authentifie) ne peut pas porter directement les deux variantes : il ne
// recoit pas le parametre [slug], seul un layout au niveau de ce segment
// (ou en dessous) l'a.
export function TopBar({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-4 lg:px-6">
      <div className="flex items-center">{left}</div>
      {center ? <div className="flex items-center">{center}</div> : null}
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}
