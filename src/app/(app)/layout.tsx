import { requireSessionOrRedirect } from "@/lib/auth-session";
import { ShellBackground } from "../shell-background";

// Shell minimal, commun a TOUTES les routes authentifiees : garde de session
// + fond plein ecran (KAN-36 P1, generalise depuis l'ecran de connexion) +
// skip-link. La sidebar/barre haute propres a un monde vivent dans
// worlds/[slug]/layout.tsx ; /worlds (hors monde) porte son propre chrome
// minimal (pas de sidebar - rien a y lister).
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireSessionOrRedirect();

  return (
    // h-dvh (hauteur de viewport dynamique) plutot qu'une chaine de
    // pourcentages (min-h-full) a travers html/body : ancre robuste,
    // independante de la propagation de hauteur des ancetres. min-h-0 sur
    // le conteneur de {children} : un enfant flex a par defaut
    // min-height:auto (grandit avec son contenu) - sans ce reset, la
    // contrainte de hauteur ne descend pas jusqu'a la sidebar/au <main>
    // scrollable, et le fond plein ecran (ShellBackground, absolute inset-0
    // sur CE conteneur) se dimensionne sur une hauteur qui varie avec le
    // contenu au lieu du viewport (cause de la bande d'artefacts constatee).
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <ShellBackground />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline focus:outline-2 focus:outline-ring"
      >
        Aller au contenu principal
      </a>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
