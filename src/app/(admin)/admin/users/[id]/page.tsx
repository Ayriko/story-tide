import Link from "next/link";
import { notFound } from "next/navigation";
import { changeUserPlanAction, changeUserRoleAction } from "@/actions/admin";
import { requireAdminOrNotFound } from "@/lib/auth-session";
import { AdminUserNotFoundError, getUserDetail } from "@/services/admin-user-service";
import { UserPlan, UserRole } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LINK_CLASSNAME,
  formatDate,
  formatDateTime,
  formatNumber,
  planSourceLabel,
} from "../../format";
import { adminMetadata } from "../../admin-metadata";
import { ChangeUserForm } from "./change-user-form";

export function generateMetadata() {
  return adminMetadata("Fiche utilisateur");
}

const CARD_TITLE_CLASSNAME = "font-heading text-base leading-snug font-medium";

const ACTION_LABELS: Record<string, string> = {
  "plan.change": "Changement de plan",
  "role.change": "Changement de rôle",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminOrNotFound();
  const { id } = await params;

  let user;
  try {
    user = await getUserDetail(id);
  } catch (error) {
    if (error instanceof AdminUserNotFoundError) {
      notFound();
    }
    throw error;
  }

  const isSelf = user.id === session.user.id;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/users" className={`self-start text-sm ${LINK_CLASSNAME}`}>
          Retour à la liste
        </Link>
        <h1 className="font-heading text-2xl font-medium break-all text-foreground">
          {user.email}
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Identité</h2>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Nom">{user.name}</Field>
              <Field label="E-mail vérifié">{user.emailVerified ? "Oui" : "Non"}</Field>
              <Field label="Inscrit le">{formatDate(user.createdAt)}</Field>
              <Field label="Compte modifié le">{formatDateTime(user.updatedAt)}</Field>
              <Field label="Rôle">
                <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>{user.role}</Badge>
              </Field>
              <Field label="Plan">
                <span className="flex items-center gap-2">
                  <Badge variant={user.plan === "UNLIMITED" ? "secondary" : "outline"}>
                    {user.plan}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {planSourceLabel(user.planSource)}
                  </span>
                </span>
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Compteurs</h2>
            <CardDescription>
              Nombres seulement : le contenu des mondes reste privé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4">
              <Field label="Mondes créés">{formatNumber(user.worldsUser)}</Field>
              <Field label="Mondes, exemples inclus">{formatNumber(user.worldsTotal)}</Field>
              <Field label="Entrées">{formatNumber(user.entities)}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Changer le plan</h2>
            <CardDescription>
              UNLIMITED lève les plafonds de mondes et d&apos;entrées. Un plan posé ici reste
              prioritaire sur un futur abonnement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangeUserForm
              action={changeUserPlanAction}
              userId={user.id}
              field="plan"
              options={Object.values(UserPlan)}
              currentValue={user.plan}
              selectLabel="Nouveau plan"
              reasonLabel="Raison du changement de plan"
              submitLabel="Changer le plan"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Changer le rôle</h2>
            <CardDescription>ADMIN donne accès à toute l&apos;administration.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangeUserForm
              action={changeUserRoleAction}
              userId={user.id}
              field="role"
              options={Object.values(UserRole)}
              currentValue={user.role}
              selectLabel="Nouveau rôle"
              reasonLabel="Raison du changement de rôle"
              submitLabel="Changer le rôle"
              lockedReason={
                isSelf
                  ? "Vous ne pouvez pas modifier votre propre rôle : un autre administrateur doit le faire."
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className={CARD_TITLE_CLASSNAME}>Historique d&apos;administration</h2>
          </CardHeader>
          <CardContent>
            {user.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune action sur ce compte.</p>
            ) : (
              <Table>
                <TableCaption className="sr-only">
                  Actions d&apos;administration sur ce compte, de la plus récente à la plus ancienne
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Date</TableHead>
                    <TableHead scope="col">Par</TableHead>
                    <TableHead scope="col">Action</TableHead>
                    <TableHead scope="col">Avant</TableHead>
                    <TableHead scope="col">Après</TableHead>
                    <TableHead scope="col">Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell>{entry.actorLabel}</TableCell>
                      <TableCell>{ACTION_LABELS[entry.action] ?? entry.action}</TableCell>
                      <TableCell>{entry.before}</TableCell>
                      <TableCell>{entry.after}</TableCell>
                      <TableCell className="whitespace-normal">{entry.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
