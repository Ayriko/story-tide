"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EntityListItem, FolderTreeView } from "@/lib/entity-types";
import {
  LEGACY_SIDEBAR_STORAGE_KEY,
  parseCollapsed,
  readCookieValue,
  resolveCollapsed,
  serializeSidebarCookie,
  SIDEBAR_COOKIE,
  sidebarScope,
  type SidebarScope,
} from "@/lib/sidebar-preference";
import { isWorldRootPath } from "@/lib/world-routes";
import { Footer } from "../../../footer";
import { LocalClock } from "../../local-clock";
import { ScrollHint } from "../../../scroll-hint";
import { TopBar } from "../../top-bar";
import { UserMenu } from "../../user-menu";
import { Sidebar } from "./sidebar";

// Preference de repli (KAN-85) : un cookie par portee (page racine du monde
// = Constellation, repliee par defaut ; autres pages, depliees), lu par le
// layout serveur ET ici. Le cookie est le « systeme externe » de
// useSyncExternalStore : l'instantane serveur (prop du layout) et le premier
// instantane client (document.cookie) sont identiques - aucun saut de la
// sidebar ni du canvas apres l'hydratation.
// Evenement DOM prive : notifie useSyncExternalStore juste apres une
// ecriture du cookie dans CET onglet.
const COLLAPSE_EVENT = "story-tide:sidebar-collapsed-change";

function subscribe(callback: () => void) {
  window.addEventListener(COLLAPSE_EVENT, callback);
  return () => window.removeEventListener(COLLAPSE_EVENT, callback);
}

function readStoredCollapsed(scope: SidebarScope): boolean | null {
  return parseCollapsed(readCookieValue(document.cookie, SIDEBAR_COOKIE[scope]));
}

function setCollapsedPersisted(scope: SidebarScope, next: boolean) {
  document.cookie = serializeSidebarCookie(scope, next, window.location.protocol === "https:");
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

// Migration transparente (KAN-85) : une preference encore en localStorage
// (KAN-87) devient le cookie, une seule fois, puis la cle est retiree. Seule
// cette toute premiere visite peut encore basculer apres l'hydratation.
function migrateLegacyPreference() {
  for (const scope of ["default", "constellation"] as const) {
    let legacy: string | null = null;
    try {
      legacy = window.localStorage.getItem(LEGACY_SIDEBAR_STORAGE_KEY[scope]);
      window.localStorage.removeItem(LEGACY_SIDEBAR_STORAGE_KEY[scope]);
    } catch {
      // Stockage indisponible (navigation privee, bloque) : rien a migrer.
      legacy = null;
    }
    const value = parseCollapsed(legacy);
    if (value !== null && readStoredCollapsed(scope) === null) {
      setCollapsedPersisted(scope, value);
    }
  }
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
  sidebarPreference,
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
  // Preference lue dans le cookie par le layout serveur (null : jamais
  // choisie, defaut de la page).
  sidebarPreference: Record<SidebarScope, boolean | null>;
  children: ReactNode;
}) {
  // Page racine du monde = la Constellation en plein cadre (KAN-87) : EGALITE
  // EXACTE sur /worlds/<slug> (world-routes.ts) - fiches et parametres
  // gardent la coquille normale (carte centrale).
  const fullBleed = isWorldRootPath(usePathname(), worldSlug);
  const scope = sidebarScope(fullBleed);
  const collapsed = useSyncExternalStore(
    subscribe,
    () => resolveCollapsed(readStoredCollapsed(scope), fullBleed),
    () => resolveCollapsed(sidebarPreference[scope], fullBleed),
  );

  useEffect(() => {
    migrateLegacyPreference();
  }, []);

  // Sidebar repliee hors d'atteinte du clavier (fix a11y, KAN-85) : `inert`
  // sur la colonne repliee ; si le focus etait dedans au moment du repli, il
  // revient au bouton qui la deplie (jamais perdu sur <body>).
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  function setCollapsed(next: boolean) {
    if (next && sidebarRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }
    setCollapsedPersisted(scope, next);
  }

  // Ctrl/Cmd+B replie/deplie (convention vvd §7) - sauf si le focus est dans
  // l'editeur Tiptap (son propre Ctrl+B bascule le gras, cf. entity-editor.tsx
  // useEditor/toggleBold - il ne faut jamais lui voler le raccourci). Lit
  // `readStoredCollapsed()` au moment du toggle (pas une valeur fermee/perimee).
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
      const next = !resolveCollapsed(readStoredCollapsed(scope), fullBleed);
      if (next && sidebarRef.current?.contains(document.activeElement)) {
        toggleRef.current?.focus();
      }
      setCollapsedPersisted(scope, next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scope, fullBleed]);

  // Page du monde (KAN-85) : la sidebar depliee est un panneau en verre pose
  // AU-DESSUS du ciel, SOUS la zone du titre (titre, menu et pilules ne
  // bougent jamais), qui ne le pousse plus : le canvas garde toute la
  // largeur. Ailleurs : colonne, sans changement. UNE SEULE instance de
  // <Sidebar>, a la meme place dans l'arbre sur toutes les pages du monde :
  // seul son conteneur change de forme. Deux instances (colonne / verre)
  // remontaient la sidebar en passant d'une fiche a la page du monde, et
  // perdaient l'etat replie/deplie de ses groupes et dossiers (BUG-008).
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div
        ref={sidebarRef}
        inert={collapsed}
        data-world-sidebar-overlay={fullBleed ? "" : undefined}
        className={cn(
          fullBleed
            ? // Gris secondaire du verre (--glass-text-muted) : AA au-dessus
              // du ciel, comme les autres panneaux de la Constellation.
              // Repliee : retiree de l'affichage (et de l'ordre de tabulation).
              cn(
                "absolute bottom-4 left-4 top-32 z-[25] flex [--muted-foreground:var(--glass-text-muted)]",
                collapsed && "hidden",
              )
            : cn(
                "flex h-full shrink-0 overflow-hidden py-4 pl-4 transition-[width] duration-200",
                collapsed ? "w-0 pl-0" : "w-72",
              ),
        )}
      >
        <Sidebar
          glass={fullBleed}
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
          {/* Page du monde (KAN-85) : la fleche se pose dans le ciel, au-dessus
              du fondu vers le pied de page, et le pied de page n'a pas de
              bordure - aucune coupure franche a la jointure. */}
          <ScrollHint placement={fullBleed ? "sky" : "default"} />
          <Footer showAdminLink={userIsAdmin} bordered={!fullBleed} />
        </div>
      </div>
    </div>
  );
}
