"use client";

import { LayoutDashboard, Users } from "lucide-react";
import { SegmentedNav, type SegmentedNavSection } from "@/components/segmented-nav";

// Sections d'administration (KAN-72). Rendu porte par SegmentedNav (KAN-81) ;
// ce composant reste client parce que les icones Lucide sont des fonctions,
// non serialisables depuis un Server Component.
// "/admin" est prefixe de toutes les autres sections : egalite stricte pour
// lui, prefixe pour les autres (la fiche /admin/users/<id> reste sous
// "Utilisateurs").
const SECTIONS: SegmentedNavSection[] = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
];

export function AdminNav() {
  return <SegmentedNav ariaLabel="Sections d'administration" sections={SECTIONS} />;
}
