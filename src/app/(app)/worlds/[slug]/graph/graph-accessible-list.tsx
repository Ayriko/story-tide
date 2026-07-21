import Link from "next/link";
import type { AccessibleGraphEntry } from "@/lib/graph-elements";

// Equivalent textuel du graphe (RGAA) : le canvas Cytoscape (graph-view.tsx)
// n'est qu'une affordance souris - meme parti pris que le surlignage live
// (ADR-0010). HTML semantique (nav + ul imbriquees + vrais <Link>), aucun
// ARIA au-dela de aria-label pour nommer la region.
export function GraphAccessibleList({
  worldSlug,
  entries,
}: {
  worldSlug: string;
  entries: AccessibleGraphEntry[];
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune relation pour l&apos;instant.</p>;
  }

  return (
    <nav aria-label="Liste des liens de la constellation">
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/worlds/${worldSlug}/entities/${entry.id}`}
              className="text-sm font-medium text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {entry.name}
            </Link>
            <ul className="mt-1 flex flex-col gap-1 pl-4">
              {entry.outgoing.map((target) => (
                <li key={target.id}>
                  <Link
                    href={`/worlds/${worldSlug}/entities/${target.id}`}
                    className="text-sm text-muted-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {/* mutual : les deux entites se mentionnent l'une l'autre
                        - un seul lien pour la paire (graph-elements.ts),
                        fleche double pour le signaler visuellement. */}
                    {target.mutual ? "↔" : "→"} {target.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
