import { Card, CardContent } from "@/components/ui/card";
import { AuthTabs } from "./auth-tabs";

// `active` optionnel (KAN-52) : les pages de reinitialisation de mot de passe
// partagent la meme carte, mais ne sont pas un troisieme onglet - elles sont
// une parenthese dans le parcours de connexion. Sans `active`, la carte est
// rendue sans la navigation Connexion/Inscription, qui n'aurait aucun etat
// courant a signaler (et `aria-current` mentirait).
export function AuthCard({
  active,
  children,
}: {
  active?: "login" | "register";
  children: React.ReactNode;
}) {
  return (
    <Card className="border-none bg-card/45 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <CardContent className="flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10">
        <span className="font-heading text-xl font-medium tracking-tight text-foreground">
          Story Tide
        </span>
        {active ? <AuthTabs active={active} /> : null}
        {children}
      </CardContent>
    </Card>
  );
}
