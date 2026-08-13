"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOOTER_ID } from "./footer";

// Bascule vers/depuis le pied de page (KAN-45, retour Aymeric) : le footer
// applicatif n'est plus une barre permanente - il vit sous la ligne de
// flottaison, dans le conteneur defilant qui enveloppe <main> ET <footer>
// (cf. commentaire dans world-shell.tsx/worlds/page.tsx, attribut
// data-scroll-container pose sur ce conteneur). Ancien design purement
// decoratif (aria-hidden) puis simple lien vers l'ancre - retour Aymeric :
// "il faudrait que cette flèche se comporte comme un bouton [...] et le
// fermer quand ouvert" -> vrai bouton a bascule, pas juste un raccourci a
// sens unique.
//
// Pas d'aria-expanded : rien n'apparait/ne disparait du DOM (le footer y
// est deja), ce serait un usage abusif de l'ARIA - meme categorie d'erreur
// que role="tab" retire d'auth-tabs.tsx (docs/accessibilite-rgaa.md). Le nom
// accessible change avec l'etat a la place. L'etat "footer visible" est
// mesure par IntersectionObserver (root = le conteneur defilant reel, pas le
// viewport - sinon la detection serait fausse dans un panneau imbrique),
// donc reste correct meme si l'utilisateur defile a la molette plutot qu'en
// cliquant.
export function ScrollHint() {
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const footer = document.getElementById(FOOTER_ID);
    const container = footer?.closest("[data-scroll-container]");
    if (!footer || !container) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(!!entry?.isIntersecting),
      {
        root: container,
        threshold: 0.1,
      },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const container = event.currentTarget.closest("[data-scroll-container]");
    if (!container) {
      return;
    }
    container.scrollTo({
      top: footerVisible ? 0 : container.scrollHeight,
      behavior: "smooth",
    });
  }

  return (
    <div className="sticky bottom-3 z-10 mb-4 flex justify-center">
      <button
        type="button"
        onClick={handleClick}
        className="flex size-8 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-lg backdrop-blur-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform", footerVisible && "rotate-180")}
        />
        <span className="sr-only">
          {footerVisible ? "Remonter en haut de page" : "Aller au pied de page"}
        </span>
      </button>
    </div>
  );
}
