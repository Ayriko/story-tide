import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : .next/standalone embarque le serveur + ses dependances
  // tracees, pour une image Docker app legere (pas de node_modules complet).
  output: "standalone",
  poweredByHeader: false,
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
