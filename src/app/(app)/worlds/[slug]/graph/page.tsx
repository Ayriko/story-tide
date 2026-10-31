import { permanentRedirect } from "next/navigation";

// /worlds/[slug]/graph (KAN-87) : la Constellation est desormais la page du
// monde elle-meme. Redirection permanente pour les liens et favoris
// existants ; un monde d'un autre proprietaire donne la meme 404 que la page
// cible (aucune lecture ici, la garde reste sur /worlds/[slug]).
export default async function GraphPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/worlds/${encodeURIComponent(slug)}`);
}
