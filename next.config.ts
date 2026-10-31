import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : .next/standalone embarque le serveur + ses dependances
  // tracees, pour une image Docker app legere (pas de node_modules complet).
  output: "standalone",
  poweredByHeader: false,
  // Indicateur de dev Next.js (badge rond bas-gauche, next dev uniquement,
  // deja absent du build de prod) : masque - confondait la review visuelle
  // du pied de page KAN-45, qui scrolle desormais jusqu'a cette zone.
  devIndicators: false,
  // Crochet de lecture e2e de la Constellation (KAN-87, graph-view.tsx) :
  // Next n'inline une variable NEXT_PUBLIC_* que si elle existe au build.
  // Declaree ici avec "" par defaut, elle est TOUJOURS inlinee : en
  // production `"1" === ""` est constant et la branche disparait du bundle
  // (verifie sur .next/static) ; seul le webServer Playwright la pose a "1".
  env: {
    NEXT_PUBLIC_E2E_HOOKS: process.env.NEXT_PUBLIC_E2E_HOOKS ?? "",
  },
  experimental: {
    serverActions: {
      // BUG-006 : la limite par defaut (1 Mo) etait atteinte avant meme le
      // controle applicatif de taille (MAX_IMAGE_BYTES = 5 Mo,
      // image-service.ts), qui reste LA limite metier - cette valeur n'est
      // qu'une marge au-dessus pour que le controle applicatif s'execute et
      // renvoie son message propre au lieu d'un 500 brut du framework.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
