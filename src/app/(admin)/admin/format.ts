// Mises en forme partagees par les trois pages d'administration (KAN-72).

export const LINK_CLASSNAME =
  "rounded-sm text-link underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// Fuseau explicite : les pages sont rendues cote serveur (UTC en production).
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const numberFormat = new Intl.NumberFormat("fr-FR");
const mebibyteFormat = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatMebibytes(bytes: number): string {
  return `${mebibyteFormat.format(bytes / (1024 * 1024))} Mio`;
}

const PLAN_SOURCE_LABELS: Record<string, string> = {
  DEFAULT: "par défaut",
  MANUAL: "posé à la main",
  SUBSCRIPTION: "abonnement",
};

export function planSourceLabel(source: string): string {
  return PLAN_SOURCE_LABELS[source] ?? source;
}
