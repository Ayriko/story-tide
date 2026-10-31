// Preference de repli de la sidebar d'un monde (KAN-85) : stockee dans un
// COOKIE lu cote serveur, pour que la page arrive directement dans le bon
// etat - plus de saut de la sidebar (ni du canvas de la Constellation) apres
// l'hydratation. Deux preferences distinctes, comme avant (KAN-87) : la page
// racine du monde (Constellation, repliee par defaut) et les autres pages
// du monde (depliee par defaut).
//
// Cookie NON httpOnly : le client l'ecrit au basculement. Ce n'est qu'une
// preference d'interface ("0" / "1"), jamais une donnee sensible ; toute
// autre valeur est ignoree (defaut de la page). docs/securite-owasp.md.

export type SidebarScope = "default" | "constellation";

export const SIDEBAR_COOKIE: Record<SidebarScope, string> = {
  default: "story-tide-sidebar-collapsed",
  constellation: "story-tide-sidebar-collapsed-constellation",
};

// Anciennes cles localStorage (KAN-87) : lues une seule fois pour migrer.
export const LEGACY_SIDEBAR_STORAGE_KEY: Record<SidebarScope, string> = {
  default: "story-tide:sidebar-collapsed",
  constellation: "story-tide:sidebar-collapsed:constellation",
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function sidebarScope(onWorldRoot: boolean): SidebarScope {
  return onWorldRoot ? "constellation" : "default";
}

// "1" replie, "0" deplie ; toute autre valeur (absente, alteree) : null.
export function parseCollapsed(value: string | null | undefined): boolean | null {
  return value === "1" ? true : value === "0" ? false : null;
}

// Repli effectif : la preference si elle existe, sinon le defaut de la page.
export function resolveCollapsed(stored: boolean | null, onWorldRoot: boolean): boolean {
  return stored ?? onWorldRoot;
}

// Valeur d'un cookie dans une chaine document.cookie ("a=1; b=2").
export function readCookieValue(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

export function serializeSidebarCookie(
  scope: SidebarScope,
  collapsed: boolean,
  secure: boolean,
): string {
  return [
    `${SIDEBAR_COOKIE[scope]}=${collapsed ? "1" : "0"}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
