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
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Aucune relation pour l&apos;instant.
      </p>
    );
  }

  return (
    <nav aria-label="Graphe (liste accessible)">
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/worlds/${worldSlug}/entities/${entry.id}`}
              className="text-sm font-medium text-zinc-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-50 dark:focus-visible:outline-zinc-50"
            >
              {entry.name}
            </Link>
            <ul className="mt-1 flex flex-col gap-1 pl-4">
              {entry.outgoing.map((target) => (
                <li key={target.id}>
                  <Link
                    href={`/worlds/${worldSlug}/entities/${target.id}`}
                    className="text-sm text-zinc-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-400 dark:focus-visible:outline-zinc-50"
                  >
                    → {target.name}
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
