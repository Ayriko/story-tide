import Link from "next/link";
import { Activity, FileText, Globe, Users, type LucideIcon } from "lucide-react";
import { requireAdminOrNotFound } from "@/lib/auth-session";
import {
  getAccountsNearLimit,
  getActivitySeries,
  getContentStats,
  getUserStats,
} from "@/services/admin-stats-service";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import pkg from "../../../../package.json";
import { ActivityChart } from "./activity-chart";
import { adminMetadata } from "./admin-metadata";
import { LINK_CLASSNAME, formatDate, formatMebibytes, formatNumber } from "./format";

export function generateMetadata() {
  return adminMetadata("Administration");
}

// Chiffres relus a chaque affichage : jamais de rendu statique d'une page
// d'administration. Pas de rafraichissement automatique en lot 1.
export const dynamic = "force-dynamic";

const CARD_TITLE_CLASSNAME = "font-heading text-base leading-snug font-medium";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

// Tuile de tete : les quatre chiffres lus en premier. Meme surface qu'une
// Card (components/ui/card.tsx), en <div> pour rester un groupe valide de <dl>.
function Tile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <dt className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {label}
        <Icon aria-hidden="true" className="size-4 shrink-0" />
      </dt>
      <dd className="font-heading text-3xl font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export default async function AdminDashboardPage() {
  await requireAdminOrNotFound();

  const [users, content, activity, nearLimit] = await Promise.all([
    getUserStats(),
    getContentStats(),
    getActivitySeries(),
    getAccountsNearLimit(),
  ]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          État du service, relu en base à chaque affichage.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={Users} label="Comptes" value={formatNumber(users.total)} />
        <Tile
          icon={Activity}
          label="Actifs sur 30 jours"
          value={formatNumber(users.activeLast30Days)}
        />
        <Tile icon={Globe} label="Mondes créés" value={formatNumber(content.worldsUser)} />
        <Tile icon={FileText} label="Entrées" value={formatNumber(content.entities)} />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Utilisateurs</h2>
            <CardDescription>
              Actif = au moins une entrée modifiée sur 30 jours, hors monde d&apos;exemple.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-4">
              <Stat label="Inscrits sur 7 jours" value={formatNumber(users.signedUpLast7Days)} />
              <Stat label="Inscrits sur 30 jours" value={formatNumber(users.signedUpLast30Days)} />
            </dl>
            <div>
              <h3 className="text-sm font-medium text-foreground">Derniers inscrits</h3>
              {users.latest.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucun compte.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {users.latest.map((user) => (
                    <li key={user.id} className="flex items-baseline justify-between gap-4">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className={`truncate ${LINK_CLASSNAME}`}
                      >
                        {user.email}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Contenu</h2>
            <CardDescription>
              Totaux en base. Le volume des images est la somme des tailles enregistrées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Mondes, exemples inclus" value={formatNumber(content.worldsTotal)} />
              <Stat label="Liens automatiques" value={formatNumber(content.relationsAuto)} />
              <Stat label="Liens manuels" value={formatNumber(content.relationsManual)} />
              <Stat label="Relations déclarées" value={formatNumber(content.relationsDeclared)} />
              <Stat label="Liens ignorés" value={formatNumber(content.linksIgnored)} />
              <Stat label="Images" value={formatNumber(content.images)} />
              <Stat label="Volume des images" value={formatMebibytes(content.imagesBytes)} />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Activité sur 30 jours</h2>
            <CardDescription>
              Entrées par jour, hors monde d&apos;exemple. Une entrée retouchée plusieurs jours de
              suite n&apos;est comptée qu&apos;au jour de sa dernière modification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityChart data={activity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Quotas</h2>
            <CardDescription>
              Comptes gratuits à 80 % ou plus d&apos;un plafond (mondes ou entrées d&apos;un monde).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nearLimit.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun compte proche d&apos;un plafond.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {nearLimit.map((account) => (
                  <li key={account.id} className="flex items-baseline justify-between gap-4">
                    <Link
                      href={`/admin/users/${account.id}`}
                      className={`truncate ${LINK_CLASSNAME}`}
                    >
                      {account.email}
                    </Link>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {account.worlds} / {account.worldLimit} mondes ·{" "}
                      {account.fullestWorldEntities} / {account.entityLimit} entrées
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Version déployée</h2>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-medium text-foreground tabular-nums">{pkg.version}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
