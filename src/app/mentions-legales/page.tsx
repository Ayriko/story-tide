import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "../footer";
import { ScrollHint } from "../scroll-hint";
import { ShellBackground } from "../shell-background";

export const metadata: Metadata = {
  title: "Mentions légales",
};

const CONTACT_LINK_CLASSNAME =
  "rounded-sm text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// Route statique volontairement HORS des groupes (auth)/(app) (KAN-45) : sous
// (app) elle heriterait de requireSessionOrRedirect() et redirigerait un
// visiteur non connecte vers /login, ce qui viderait la page de son objet -
// une mention legale doit rester consultable sans session. RSC pur, aucun
// etat, meme structure de chrome que (auth)/layout.tsx (ShellBackground +
// h-dvh + conteneur defilant + Footer) pour rester coherente visuellement
// sans dupliquer un layout - y compris le correctif KAN-45 (retour Aymeric,
// capture-footer.PNG) : sans hauteur de viewport contrainte, le footer
// s'affichait entierement au premier ecran ici aussi.
export default function MentionsLegalesPage() {
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
        <main id="main-content" className="mx-auto min-h-full w-full max-w-2xl px-4 py-12 lg:px-6">
          <div className="flex flex-col gap-8 rounded-xl border-none bg-card/70 px-6 py-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-8 sm:py-10">
            <div>
              <h1 className="font-heading text-2xl font-medium text-foreground">
                Mentions légales
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Story Tide est un projet réalisé dans le cadre d&apos;une certification
                professionnelle, mis à disposition à titre gratuit et sans finalité commerciale.
              </p>
            </div>

            <section aria-labelledby="editeur-heading" className="flex flex-col gap-2">
              <h2 id="editeur-heading" className="font-heading text-sm font-medium text-foreground">
                Éditeur du site
              </h2>
              <p className="text-sm text-muted-foreground">
                Aymeric Moiska, personne physique, éditeur du site sous le nom de projet « Tidemark
                Studio ». Contact :{" "}
                <a href="mailto:contact@storytide.fr" className={CONTACT_LINK_CLASSNAME}>
                  contact@storytide.fr
                </a>
                . En l&apos;absence d&apos;activité professionnelle liée à ce site (éditeur non
                professionnel au sens de la LCEN), aucune adresse postale n&apos;est publiée ;
                l&apos;hébergeur ci-dessous détient l&apos;identité complète de l&apos;éditeur.
              </p>
            </section>

            <section aria-labelledby="directeur-heading" className="flex flex-col gap-2">
              <h2
                id="directeur-heading"
                className="font-heading text-sm font-medium text-foreground"
              >
                Directeur de la publication
              </h2>
              <p className="text-sm text-muted-foreground">Aymeric Moiska.</p>
            </section>

            <section aria-labelledby="hebergeur-heading" className="flex flex-col gap-2">
              <h2
                id="hebergeur-heading"
                className="font-heading text-sm font-medium text-foreground"
              >
                Hébergeur
              </h2>
              <p className="text-sm text-muted-foreground">
                OVHcloud, 2 rue Kellermann, 59100 Roubaix, France.
              </p>
            </section>

            <section aria-labelledby="donnees-heading" className="flex flex-col gap-2">
              <h2 id="donnees-heading" className="font-heading text-sm font-medium text-foreground">
                Données personnelles
              </h2>
              <p className="text-sm text-muted-foreground">
                Story Tide collecte l&apos;adresse e-mail et le nom d&apos;affichage renseignés à
                l&apos;inscription, le mot de passe (haché, jamais conservé en clair), ainsi que les
                contenus créés (mondes, entrées, images déposées). Ces données servent uniquement à
                faire fonctionner le service : authentifier chaque compte et rattacher les contenus
                à leur auteur.
              </p>
              <p className="text-sm text-muted-foreground">
                Droits d&apos;accès, de rectification et de suppression : ces droits s&apos;exercent
                par courriel à{" "}
                <a href="mailto:contact@storytide.fr" className={CONTACT_LINK_CLASSNAME}>
                  contact@storytide.fr
                </a>
                , demande traitée sous 30 jours. La suppression est effectuée manuellement par
                l&apos;éditeur — aucune suppression de compte en autonomie n&apos;est disponible à
                ce stade.
              </p>
              <p className="text-sm text-muted-foreground">
                Cookies : seul un cookie de session d&apos;authentification est déposé (
                <code className="text-foreground">HttpOnly</code>,{" "}
                <code className="text-foreground">SameSite=Lax</code>). Aucun cookie de mesure
                d&apos;audience, aucun traceur publicitaire, aucun cookie tiers.
              </p>
            </section>

            <section aria-labelledby="contact-heading" className="flex flex-col gap-2">
              <h2 id="contact-heading" className="font-heading text-sm font-medium text-foreground">
                Contact
              </h2>
              <p className="text-sm text-muted-foreground">
                Retours bêta, questions ou exercice des droits ci-dessus :{" "}
                <a href="mailto:contact@storytide.fr" className={CONTACT_LINK_CLASSNAME}>
                  contact@storytide.fr
                </a>
                .
              </p>
            </section>

            <Link
              href="/"
              className="w-fit rounded-sm text-sm text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              ← Retour à Story Tide
            </Link>
          </div>
        </main>
        <ScrollHint />
        <Footer />
      </div>
    </div>
  );
}
