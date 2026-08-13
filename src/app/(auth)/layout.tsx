import { Footer } from "../footer";
import { ScrollHint } from "../scroll-hint";
import { ShellBackground } from "../shell-background";

// h-dvh + conteneur defilant dedie (KAN-45, retour Aymeric sur
// capture-footer.PNG) : sans hauteur de viewport contrainte, le footer
// s'affichait entierement au premier ecran (rien ne forcait la page a ne
// montrer qu'un "ecran plein" a la fois) - meme structure que
// (app)/layout.tsx et worlds/page.tsx, pour que le footer reste hors du
// cadre par defaut ici aussi, atteint en defilant ou via ScrollHint.
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <ShellBackground />

      {/* no-scrollbar (retour Aymeric) : scrollbar visuelle masquee, le
          defilement reste fonctionnel. data-scroll-container : ancre
          reperee par ScrollHint (closest()) pour cibler CE conteneur. */}
      <div
        data-scroll-container
        className="relative z-10 min-h-0 flex-1 no-scrollbar scroll-smooth overflow-y-auto"
      >
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 md:items-end md:px-12 md:py-16 lg:px-20">
          <main className="w-full max-w-md md:w-[32rem]">{children}</main>
        </div>
        <ScrollHint />
        <Footer />
      </div>
    </div>
  );
}
