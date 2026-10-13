// Decoupage de l'activite par jour pour le tableau de bord d'administration
// (KAN-72). Fonction pure : Prisma groupBy ne tronque pas une date au jour,
// le service ne remonte donc que deux horodatages par entree et le comptage
// se fait ici, testable sans base.

export type ActivityDay = {
  // Jour civil au format AAAA-MM-JJ, fuseau Europe/Paris.
  date: string;
  created: number;
  modified: number;
};

export const ACTIVITY_DAYS = 30;

// en-CA formate en AAAA-MM-JJ. Fuseau fixe : le tableau de bord doit donner
// le meme decoupage quel que soit le fuseau du serveur (UTC en production).
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayKey(date: Date): string {
  return dayKeyFormat.format(date);
}

// Les `days` derniers jours civils, du plus ancien au plus recent, `now`
// inclus. Arithmetique sur un midi UTC : jamais de jour saute ou double au
// changement d'heure.
function lastDayKeys(now: Date, days: number): string[] {
  const todayNoonUtc = new Date(`${dayKey(now)}T12:00:00.000Z`).getTime();
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    keys.push(new Date(todayNoonUtc - offset * 86_400_000).toISOString().slice(0, 10));
  }
  return keys;
}

// `modified` compte les entrees dont la DERNIERE modification tombe ce jour
// (Entity.updatedAt ne garde que la derniere) : une entree retouchee dix jours
// de suite compte une fois, le dernier jour, et une entree creee compte aussi
// comme modifiee le jour de sa creation.
export function bucketActivity(
  rows: ReadonlyArray<{ createdAt: Date; updatedAt: Date }>,
  now: Date,
  days: number = ACTIVITY_DAYS,
): ActivityDay[] {
  const byDay = new Map<string, ActivityDay>(
    lastDayKeys(now, days).map((date) => [date, { date, created: 0, modified: 0 }]),
  );

  for (const row of rows) {
    const createdDay = byDay.get(dayKey(row.createdAt));
    if (createdDay) {
      createdDay.created += 1;
    }
    const modifiedDay = byDay.get(dayKey(row.updatedAt));
    if (modifiedDay) {
      modifiedDay.modified += 1;
    }
  }

  return [...byDay.values()];
}
