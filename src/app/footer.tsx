import Link from "next/link";
import { ExternalLink } from "lucide-react";

// Pied de page partage entre (auth) et (app) (KAN-45 - canal officiel de
// retours beta). <footer> natif = landmark "contentinfo" implicite : ce
// composant ne doit jamais etre rendu a l'interieur d'un <main>/<section>/
// <article>, sinon le role implicite disparait (voir les call-sites : le
// scroll a ete deplace au-dessus de <main> dans world-shell.tsx et
// worlds/page.tsx pour garantir ca). Couleurs reprises telles quelles du fil
// d'ariane (world-shell.tsx) - foreground/hover:primary, meme anneau de
// focus - donc deja couvertes par les ratios verifies de globals.css. Le
// lien externe (statut du service) ajoute une icone + un texte masque
// visuellement pour etre annonce par un lecteur d'ecran (RGAA : un lien
// externe doit etre identifiable avant activation).
const LINK_CLASSNAME =
  "rounded-sm text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// Repere par ScrollHint (scroll-hint.tsx, document.getElementById) pour
// savoir si le pied de page est visible et le faire defiler - id partage
// via cette constante plutot que deux chaines litterales, pour ne jamais
// pouvoir diverger.
export const FOOTER_ID = "site-footer";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id={FOOTER_ID} className="border-t border-border px-4 py-6 lg:px-6">
      <div className="mx-auto flex max-w-[1150px] flex-col items-center gap-3 text-sm sm:flex-row sm:justify-between">
        <p className="text-muted-foreground">© {year} Tidemark Studio</p>
        <nav aria-label="Liens légaux et support" className="flex items-center gap-4">
          <Link href="/mentions-legales" className={LINK_CLASSNAME}>
            Mentions légales
          </Link>
          <a href="mailto:contact@storytide.fr" className={LINK_CLASSNAME}>
            contact@storytide.fr
          </a>
          <a
            href="https://status.storytide.fr"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 ${LINK_CLASSNAME}`}
          >
            Statut du service
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">(nouvelle fenêtre)</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
