import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Profil/deconnexion (KAN-36 P1-ter, patron rail vvd §6) : vit dans la
// TopBar dans les deux contextes (hors monde et dans un monde) - jamais dans
// la sidebar. Affiche le nom Better Auth (`user.name`, saisi obligatoirement
// a l'inscription - actions/auth.ts) plutot que l'e-mail brut ; repli sur
// l'e-mail si le nom est vide (donnee legacy/inattendue).
export function UserMenu({ name, email }: { name: string; email: string }) {
  const displayName = name.trim() || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* aria-label distinct du contenu visible : le nom accessible ne doit
            pas dependre du contenu arbitraire du nom/e-mail (un e-mail de
            test e2e contenant par coincidence un mot comme "image" est deja
            entre en collision par sous-chaine avec un autre bouton de la
            page, getByRole matchant par defaut en sous-chaine). */}
        <Button
          type="button"
          variant="ghost"
          aria-label="Menu utilisateur"
          className="max-w-[14rem] justify-start truncate px-2 text-sm font-normal text-muted-foreground"
        >
          {displayName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col font-normal">
          <span className="truncate text-foreground">{displayName}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              Se déconnecter
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
