import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorldSettingsNav } from "./world-settings-nav";

// Coquille des parametres du monde (KAN-81) : retour au monde, titre,
// onglets. Aucune donnee
// ici - la garde de proprietaire est faite par le layout du monde
// (worlds/[slug]/layout.tsx) ET par chaque page de parametres (meme patron
// que les autres pages du monde : layout et page rendus en parallele, la page
// ne compte jamais sur la garde du layout).
export default async function WorldSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex flex-col gap-6">
      {/* Bouton de retour : meme patron que la Constellation
          (graph/page.tsx) - visuel de bouton, semantique de lien. */}
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={`/worlds/${slug}`}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Retour au monde
        </Link>
      </Button>
      <h1 className="font-heading text-3xl font-medium text-foreground">Paramètres du monde</h1>
      <WorldSettingsNav worldSlug={slug} />
      {children}
    </div>
  );
}
