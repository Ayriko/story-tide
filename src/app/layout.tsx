import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
