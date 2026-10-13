import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { listUsersQuerySchema } from "@/lib/admin-schemas";
import { requireAdminOrNotFound } from "@/lib/auth-session";
import { listUsers } from "@/services/admin-user-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminMetadata } from "../admin-metadata";
import { LINK_CLASSNAME, formatDate, formatNumber, planSourceLabel } from "../format";

export function generateMetadata() {
  return adminMetadata("Utilisateurs");
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) {
    params.set("q", q);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  await requireAdminOrNotFound();

  const raw = await searchParams;
  const query = listUsersQuerySchema.parse({ q: first(raw.q), page: first(raw.page) });
  const { users, total, page, pageCount } = await listUsers(query);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium text-foreground">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">
            Cliquer sur une ligne ouvre la fiche du compte : rôle, plan et historique.
          </p>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {formatNumber(total)} {total > 1 ? "comptes" : "compte"}
          {query.q ? ` pour « ${query.q} »` : ""}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          {/* Formulaire GET natif : la recherche vit dans l'URL, sans JavaScript.
              Label masque visuellement : le bouton "Rechercher" accole et le
              texte indicatif nomment le champ a l'ecran. */}
          <form
            action="/admin/users"
            method="get"
            role="search"
            className="flex flex-wrap items-center gap-3"
          >
            <Label htmlFor="q" className="sr-only">
              Rechercher par e-mail ou nom
            </Label>
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={query.q}
                placeholder="E-mail ou nom"
                autoComplete="off"
                className="pl-9"
              />
            </div>
            <Button type="submit">Rechercher</Button>
            {query.q ? (
              <Link href="/admin/users" className={`text-sm ${LINK_CLASSNAME}`}>
                Effacer
              </Link>
            ) : null}
          </form>

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun compte ne correspond.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Comptes, du plus récent au plus ancien
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">E-mail</TableHead>
                  <TableHead scope="col">Nom</TableHead>
                  <TableHead scope="col">Inscrit le</TableHead>
                  <TableHead scope="col">Rôle</TableHead>
                  <TableHead scope="col">Plan</TableHead>
                  <TableHead scope="col" className="text-right">
                    Mondes
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Entrées
                  </TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Ouvrir la fiche</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  // Ligne entiere cliquable SANS gestionnaire de clic : le
                  // seul lien de la ligne (l'e-mail) est etire sur elle par
                  // son pseudo-element ::after (after:absolute after:inset-0,
                  // rattache au <tr> en position relative). Un seul arret
                  // clavier par compte, et le lien reste un vrai <a>.
                  <TableRow key={user.id} className="group relative hover:bg-foreground/5">
                    <TableCell>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className={`after:absolute after:inset-0 ${LINK_CLASSNAME}`}
                      >
                        {user.email}
                      </Link>
                    </TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Badge variant={user.plan === "UNLIMITED" ? "secondary" : "outline"}>
                          {user.plan}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {planSourceLabel(user.planSource)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(user.worlds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(user.entities)}
                    </TableCell>
                    <TableCell className="w-8 text-muted-foreground group-hover:text-foreground">
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pageCount > 1 ? (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between gap-4 text-sm"
            >
              {page > 1 ? (
                <Link href={pageHref(query.q, page - 1)} rel="prev" className={LINK_CLASSNAME}>
                  Page précédente
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Page {page} sur {pageCount}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(query.q, page + 1)} rel="next" className={LINK_CLASSNAME}>
                  Page suivante
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
