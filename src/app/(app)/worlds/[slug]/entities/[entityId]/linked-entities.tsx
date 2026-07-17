import Link from "next/link";
import type { LinkedEntity } from "@/services/relation-service";

// Chemin de navigation ACCESSIBLE (clavier/lecteur d'ecran) vers les fiches
// liees - le surlignage live dans l'editeur (tiptap-link-highlight.ts,
// Ctrl/Cmd+clic) n'est atteignable qu'a la souris, cf. RGAA. HTML semantique
// (nav + ul + vrais <Link>) : aucun ARIA necessaire au-dela de aria-labelledby
// pour associer la liste a son titre de section. Reutilise pour les deux sens
// (liens sortants et backlinks entrants, KAN-24) via `label`/`emptyLabel` -
// chaque <nav> garde un nom accessible distinct.
export function LinkedEntities({
  worldSlug,
  links,
  label,
  emptyLabel,
}: {
  worldSlug: string;
  links: LinkedEntity[];
  label: string;
  emptyLabel: string;
}) {
  if (links.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyLabel}</p>;
  }

  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              href={`/worlds/${worldSlug}/entities/${link.id}`}
              className="block rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-50"
            >
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
