"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { ActivityDay } from "@/lib/activity-buckets";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Deux series, deux teintes verifiees sur la surface carte (#1c3a4b) :
// separation daltonisme et contraste >= 3:1. --chart-1 (#1fb39a) sort de la
// bande de clarte et --chart-3/--chart-4 se confondent avec les surfaces,
// d'ou un sarcelle un cran plus sombre pose ici plutot que les tokens du
// theme. La seconde serie est en tirets : l'identite ne repose jamais sur la
// couleur seule.
const chartConfig = {
  created: { label: "Entrées créées", color: "#1aa68f" },
  modified: { label: "Dernière modification", color: "var(--primary)" },
} satisfies ChartConfig;

const tickFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// `date` est deja un jour civil (AAAA-MM-JJ, Europe/Paris) : formate en UTC
// pour ne jamais le decaler d'un jour selon le fuseau du navigateur.
function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function ActivityChart({ data }: { data: ActivityDay[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value: string) => tickFormat.format(parseDay(value))}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_value, payload) => {
                  const date: unknown = payload[0]?.payload?.date;
                  return typeof date === "string" ? longFormat.format(parseDay(date)) : null;
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="created"
            type="monotone"
            stroke="var(--color-created)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey="modified"
            type="monotone"
            stroke="var(--color-modified)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
          />
        </LineChart>
      </ChartContainer>

      {/* Vue tableau : les memes chiffres sans le graphique (lecteur d'ecran,
          clavier, lecture exacte d'une valeur). */}
      <details className="text-sm">
        <summary className="cursor-pointer rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Voir les données du graphique
        </summary>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">
            Entrées créées et dernières modifications par jour, sur 30 jours
          </caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                Jour
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                Entrées créées
              </th>
              <th scope="col" className="py-1 font-medium">
                Dernière modification
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((day) => (
              <tr key={day.date} className="border-t border-border">
                <th scope="row" className="py-1 pr-4 font-normal">
                  {longFormat.format(parseDay(day.date))}
                </th>
                <td className="py-1 pr-4 tabular-nums">{day.created}</td>
                <td className="py-1 tabular-nums">{day.modified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
