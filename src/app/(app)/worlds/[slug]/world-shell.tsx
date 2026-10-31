"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EntityListItem, FolderTreeView } from "@/lib/entity-types";
import { isWorldRootPath } from "@/lib/world-routes";
import { Footer } from "../../../footer";
import { LocalClock } from "../../local-clock";
import { ScrollHint } from "../../../scroll-hint";
import { TopBar } from "../../top-bar";
import { UserMenu } from "../../user-menu";
import { Sidebar } from "./sidebar";

const COLLAPSE_STORAGE_KEY = "story-tide:sidebar-collapsed";
// Page racine du monde (Constellation, KAN-87) : etat de repli PROPRE, replie
// par defaut tant que l'utilisateur n'a pas deplie la sidebar sur cette page.
const ROOT_COLLAPSE_STORAGE_KEY = "story-tide:sidebar-collapsed:constellation";
// Evenement DOM prive (pas "storage", qui ne se declenche que dans les
// AUTRES onglets, jamais celui qui ecrit) : notifie useSyncExternalStore
// immediatement apres une ecriture localStorage dans CET onglet.
const COLLAPSE_EVENT = "story-tide:sidebar-collapsed-change";

function subscribe(callback: () => void) {
  window.addEventListener(COLLAPSE_EVENT, callback);
  return () => window.removeEventListener(COLLAPSE_EVENT, callback);
}
// Lecture/ecriture protegees (stockage bloque, navigation privee) : en cas
// d'echec, la valeur par defaut s'applique, sans erreur.
function readCollapsed(onWorldRoot: boolean): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(
      onWorldRoot ? ROOT_COLLAPSE_STORAGE_KEY : COLLAPSE_STORAGE_KEY,
    );
  } catch {
    stored = null;
  }
  return stored === null ? onWorldRoot : stored === "1";
}
// Premier rendu serveur : depliee, sauf sur la page racine du monde (repliee
// par defaut) - meme valeur que le premier rendu client sans preference,
// aucun hydration mismatch. useSyncExternalStore est le mecanisme React
// dedie a une valeur pilotee par un systeme externe (ici : localStorage),
// sans setState synchrone dans un effet (regle react-hooks/
// set-state-in-effect, meme raisonnement que local-clock.tsx).
function setCollapsedPersisted(onWorldRoot: boolean, next: boolean) {
  try {
    window.localStorage.setItem(
      onWorldRoot ? ROOT_COLLAPSE_STORAGE_KEY : COLLAPSE_STORAGE_KEY,
      next ? "1" : "0",
    );
  } catch {
    // Stockage indisponible : le choix ne survit pas au rechargement.
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

// Coquille cliente du monde (KAN-36 P1-ter) : porte l'etat de repli de la
// sidebar (partage entre le bouton de la TopBar et le panneau lui-meme) -
// worlds/[slug]/layout.tsx (Server Component) recupere les donnees
// (monde/entites/session) et delegue tout le rendu ici en simples props ;
// {children} reste le contenu de page RENDU SERVEUR (RSC), passe tel quel -
// aucune hydratation cote client de son contenu, patron officiel Next.js
// "passer un Server Component en enfant d'un Client Component".
export function WorldShell({
  worldId,
  worldName,
  worldSlug,
  entities,
  folderTree,
  unfiledEntities,
  userName,
  userEmail,
  userIsAdmin,
  children,
}: {
  worldId: string;
  worldName: string;
  worldSlug: string;
  entities: EntityListItem[];
  folderTree: FolderTreeView[];
  unfiledEntities: EntityListItem[];
  userName: string;
  userEmail: string;
  userIsAdmin: boolean;
  children: ReactNode;
}) {
  // Page racine du monde = la Constellation en plein cadre (KAN-87) : EGALITE
  // EXACTE sur /worlds/<slug> (world-routes.ts) - fiches et parametres
  // gardent la coquille normale (carte centrale).
  const fullBleed = isWorldRootPath(usePathname(), worldSlug);
  const collapsed = useSyncExternalStore(
    subscribe,
    () => readCollapsed(fullBleed),
    () => fullBleed,
  );

  // Sidebar repliee hors d'atteinte du clavier (fix a11y, KAN-85) : `inert`
  // sur la colonne repliee ; si le focus etait dedans au moment du repli, il
  // revient au bouton qui la deplie (jamais perdu sur <body>).
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  function setCollapsed(next: boolean) {
    if (next && sidebarRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }
    setCollapsedPersisted(fullBleed, next);
  }

  // Ctrl/Cmd+B replie/deplie (convention vvd §7) - sauf si le focus est dans
  // l'editeur Tiptap (son propre Ctrl+B bascule le gras, cf. entity-editor.tsx
  // useEditor/toggleBold - il ne faut jamais lui voler le raccourci). Lit
  // `readCollapsed()` au moment du toggle (pas une valeur fermee/perimee).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isModB = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b";
      if (!isModB) {
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement.closest(".ProseMirror")) {
        return;
      }
      event.preventDefault();
      const next = !readCollapsed(fullBleed);
      if (next && sidebarRef.current?.contains(document.activeElement)) {
        toggleRef.current?.focus();
      }
      setCollapsedPersisted(fullBleed, next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullBleed]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div
        ref={sidebarRef}
        inert={collapsed}
        className={cn(
          "flex h-full shrink-0 overflow-hidden py-4 pl-4 transition-[width] duration-200",
          collapsed ? "w-0 pl-0" : "w-72",
        )}
      >
        <Sidebar
          worldId={worldId}
          worldSlug={worldSlug}
          entities={entities}
          folderTree={folderTree}
          unfiledEntities={unfiledEntities}
        />
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Page racine du monde (KAN-87) : la barre haute flotte, transparente,
            au-dessus de la Constellation (qui occupe toute la hauteur) ; seuls
            ses controles captent le pointeur, le reste laisse passer vers le
            canvas. */}
        <div className={cn(fullBleed && "pointer-events-none absolute inset-x-0 top-0 z-30")}>
          <TopBar
            left={
              <div className="pointer-events-auto flex items-center gap-2">
                <Button
                  ref={toggleRef}
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(!collapsed)}
                  aria-label={
                    collapsed ? "Afficher la liste des entrées" : "Masquer la liste des entrées"
                  }
                >
                  {collapsed ? (
                    <PanelLeftOpen aria-hidden="true" className="size-4" />
                  ) : (
                    <PanelLeftClose aria-hidden="true" className="size-4" />
                  )}
                </Button>
                {/* Fil d'ariane (reference-vvd.md §6) : "Story Tide / <monde>" -
                  cliquer le nom du monde ramene a son accueil. Pas de <h1> ici,
                  cf. commentaire dans worlds/[slug]/page.tsx. */}
                <nav
                  aria-label="Fil d'ariane"
                  className="flex items-center gap-1.5 font-heading text-base font-semibold"
                >
                  <Link
                    href="/worlds"
                    className="text-foreground hover:text-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Story Tide
                  </Link>
                  {/* Page du monde (KAN-87) : le titre est pose sur le canvas,
                      le fil d'ariane ne le repete pas. */}
                  {fullBleed ? null : (
                    <>
                      <span aria-hidden="true" className="text-muted-foreground">
                        /
                      </span>
                      <Link
                        href={`/worlds/${worldSlug}`}
                        className="text-foreground hover:text-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {worldName}
                      </Link>
                    </>
                  )}
                </nav>
              </div>
            }
            right={
              <span className="pointer-events-auto flex items-center gap-3">
                <LocalClock />
                <UserMenu name={userName} email={userEmail} />
              </span>
            }
          />
        </div>

        {/* Conteneur defilant (KAN-45) : deplace depuis <main> pour que
            <footer> (rendu apres lui, hors de <main>) reste un landmark
            "contentinfo" de premier niveau (perdu si imbrique dans <main>).
            <main> repasse en overflow-visible - c'est desormais CE div, et
            non plus <main>, le vrai conteneur defilant vise par le
            commentaire "sticky" ci-dessous (KAN-39 volet 3). scroll-smooth :
            defilement fluide au clic sur ScrollHint. no-scrollbar (retour
            Aymeric) : scrollbar visuelle masquee, le defilement reste
            fonctionnel. data-scroll-container : ancre reperee par
            ScrollHint (closest()) pour cibler CE conteneur precis.
            relative (BUG-014) : OBLIGATOIRE. Un conteneur defilant ne clippe
            que les descendants dont il est le bloc conteneur ; un descendant
            en position:absolute se rattache a l'ancetre positionne le plus
            proche. Sans "relative" ici, le <span class="sr-only"> du lien
            externe du pied de page (footer.tsx - sr-only vaut
            position:absolute) se rattachait au shell h-dvh, s'echappait de ce
            conteneur et etirait le scrollHeight du shell. Le shell devenait
            alors defilable : le scrollIntoView du caret le faisait glisser
            d'un ecran entier, sans retour possible (ni molette ni barre) - les
            trois symptomes signales ("bloc" en bas, texte hors de vue, zone
            morte sous le pied de page) sont ce seul defaut. Les conteneurs
            equivalents de (auth)/layout.tsx et mentions-legales/page.tsx
            portaient deja "relative" - d'ou l'absence de defaut sur ces
            pages. */}
        <div
          data-scroll-container
          className="relative no-scrollbar min-h-0 flex-1 scroll-smooth overflow-y-auto"
        >
          {fullBleed ? (
            // Constellation (KAN-87) : toute la hauteur de l'ecran, sans carte
            // centrale ; le pied de page reste dessous, atteint par ScrollHint.
            <main id="main-content" className="h-full overflow-hidden">
              {children}
            </main>
          ) : (
            <main id="main-content" className="min-h-full overflow-visible px-4 pb-10 lg:px-6">
              {/* min-h-full (retour Aymeric, capture-footer.PNG) : sans
                contrainte de hauteur, une fiche courte laissait le footer
                depasser un peu au premier ecran au lieu de rester hors du
                cadre par defaut, contrairement a worlds/page.tsx qui a deja
                ce comportement via son propre <main>. */}
              {/* overflow-visible (KAN-39 volet 3) : le style de base de Card
                porte overflow-hidden (components/ui/card.tsx) - un ancetre
                overflow!=visible entre un element sticky et son vrai
                conteneur defilant (le div ci-dessus) neutralise
                position:sticky (constate sur la toolbar de l'editeur).
                Override cible sur cet usage precis uniquement - les autres
                Card de l'app gardent leur clipping. */}
              <Card className="mx-auto max-w-[1150px] overflow-visible border-none bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <div className="px-6 py-8 sm:px-8 sm:py-10">{children}</div>
              </Card>
            </main>
          )}
          <ScrollHint />
          <Footer showAdminLink={userIsAdmin} />
        </div>
      </div>
    </div>
  );
}
