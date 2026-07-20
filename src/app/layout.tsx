import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // Fraunces expose des axes optiques variables (opsz) - registre "ecriture/
  // recit" plus marque a l'usage titre (reference-vvd.md §2.2).
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Story Tide",
  description: "Plateforme de worldbuilding avec liaison automatique des entités.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      {/* suppressHydrationWarning : des extensions navigateur (ex. ColorZilla,
          cz-shortcut-listen) injectent des attributs sur <body> avant
          l'hydratation React - faux positif documente, hors de portee de
          l'app (https://react.dev/link/hydration-mismatch). */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
