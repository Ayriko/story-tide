import { ExternalLink } from "lucide-react";

// Credit de l'artiste de l'artwork de marque (KAN-xx, retour Aymeric).
// Encart "vitre depolie" (memes ingredients que auth-card.tsx : fond
// translucide + backdrop-blur) pose en coin, hors du conteneur defilant -
// reste visible quelle que soit la position de defilement, comme un
// filigrane. Place APRES le conteneur defilant dans le DOM pour ne pas
// interrompre l'ordre de tabulation du formulaire (atteint en dernier,
// apres le pied de page). Lien externe : icone + texte masque
// visuellement, meme patron RGAA que footer.tsx (un lien externe doit
// etre identifiable avant activation).
export function ArtistCredit() {
  return (
    <a
      href="https://vgen.co/dvkin"
      target="_blank"
      rel="noopener noreferrer"
      title="Illustration par @Dvkin"
      className="absolute bottom-4 left-4 z-20 inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-foreground/90 shadow-lg backdrop-blur-md transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      @Dvkin
      <ExternalLink aria-hidden="true" className="size-3" />
      <span className="sr-only">(nouvelle fenêtre)</span>
    </a>
  );
}
