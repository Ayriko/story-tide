"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EntitySearchResult } from "@/services/entity-service";
import { LocalClock } from "../../local-clock";
import { TopBar } from "../../top-bar";
import { UserMenu } from "../../user-menu";
import { FOCUS_SEARCH_EVENT } from "./entity-search";
import { Sidebar } from "./sidebar";
import { WorldSettingsDialog } from "./world-settings-dialog";

const COLLAPSE_STORAGE_KEY = "story-tide:sidebar-collapsed";
// Evenement DOM prive (pas "storage", qui ne se declenche que dans les
// AUTRES onglets, jamais celui qui ecrit) : notifie useSyncExternalStore
// immediatement apres une ecriture localStorage dans CET onglet.
const COLLAPSE_EVENT = "story-tide:sidebar-collapsed-change";

function subscribe(callback: () => void) {
  window.addEventListener(COLLAPSE_EVENT, callback);
  return () => window.removeEventListener(COLLAPSE_EVENT, callback);
}
function getSnapshot() {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
}
// Jamais repliee au premier rendu serveur (localStorage n'existe pas cote
// serveur) - evite un hydration mismatch. useSyncExternalStore est le
// mecanisme React dedie a une valeur pilotee par un systeme externe (ici :
// localStorage), sans setState synchrone dans un effet (regle react-hooks/
// set-state-in-effect, meme raisonnement que local-clock.tsx).
function getServerSnapshot() {
  return false;
}
function setCollapsedPersisted(next: boolean) {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
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
  userName,
  userEmail,
  children,
}: {
  worldId: string;
  worldName: string;
  worldSlug: string;
  entities: EntitySearchResult[];
  userName: string;
  userEmail: string;
  children: ReactNode;
}) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Ctrl/Cmd+B replie/deplie (convention vvd §7) - sauf si le focus est dans
  // l'editeur Tiptap (son propre Ctrl+B bascule le gras, cf. entity-editor.tsx
  // useEditor/toggleBold - il ne faut jamais lui voler le raccourci). Lit
  // `getSnapshot()` au moment du toggle (pas une valeur fermee/perimee) :
  // pas besoin de re-attacher l'ecouteur a chaque changement d'etat.
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
      setCollapsedPersisted(!getSnapshot());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Chip "Rechercher" du dashboard (KAN-36 P3) : deplie la sidebar si repliee
  // avant que entity-search.tsx (meme evenement, ecouteur separe) ne mette le
  // focus dans le champ - sinon le champ reste focusable mais visuellement
  // clippe (largeur 0) tant que la sidebar est repliee.
  useEffect(() => {
    function onFocusSearch() {
      if (getSnapshot()) {
        setCollapsedPersisted(false);
      }
    }
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          "flex h-full shrink-0 overflow-hidden py-4 pl-4 transition-[width] duration-200",
          collapsed ? "w-0 pl-0" : "w-72",
        )}
      >
        <Sidebar worldId={worldId} worldSlug={worldSlug} entities={entities} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar
          left={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsedPersisted(!collapsed)}
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
                  className="text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Story Tide
                </Link>
                <span aria-hidden="true" className="text-muted-foreground">
                  /
                </span>
                <Link
                  href={`/worlds/${worldSlug}`}
                  className="text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {worldName}
                </Link>
              </nav>
            </div>
          }
          right={
            <>
              <WorldSettingsDialog worldId={worldId} worldName={worldName} />
              <LocalClock />
              <UserMenu name={userName} email={userEmail} />
            </>
          }
        />

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 lg:px-6">
          <Card className="mx-auto max-w-[1150px] border-none bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="px-6 py-8 sm:px-8 sm:py-10">{children}</div>
          </Card>
        </main>
      </div>
    </div>
  );
}
