"use client";

import { Settings2, Tags } from "lucide-react";
import { SegmentedNav } from "@/components/segmented-nav";

// Onglets des parametres du monde (KAN-81) : sous-routes adressables par URL,
// meme controle segmente que /admin. Client pour la meme raison qu'AdminNav
// (icones Lucide non serialisables depuis un Server Component).
export function WorldSettingsNav({ worldSlug }: { worldSlug: string }) {
  const base = `/worlds/${worldSlug}/settings`;
  return (
    <SegmentedNav
      ariaLabel="Sections des paramètres du monde"
      sections={[
        { href: base, label: "Général", icon: Settings2, exact: true },
        { href: `${base}/types`, label: "Types d'entrées", icon: Tags },
      ]}
    />
  );
}
