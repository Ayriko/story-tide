import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : .next/standalone embarque le serveur + ses dependances
  // tracees, pour une image Docker app legere (pas de node_modules complet).
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
