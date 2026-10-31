import { describe, expect, it } from "vitest";
import {
  parseCollapsed,
  readCookieValue,
  resolveCollapsed,
  serializeSidebarCookie,
  SIDEBAR_COOKIE,
  sidebarScope,
} from "./sidebar-preference";

describe("parseCollapsed", () => {
  it("n'accepte que 0 et 1", () => {
    expect(parseCollapsed("1")).toBe(true);
    expect(parseCollapsed("0")).toBe(false);
    for (const invalid of [undefined, null, "", "true", "01", " 1"]) {
      expect(parseCollapsed(invalid)).toBeNull();
    }
  });
});

describe("resolveCollapsed", () => {
  it("preference memorisee prioritaire, sinon defaut de la page", () => {
    expect(resolveCollapsed(false, true)).toBe(false);
    expect(resolveCollapsed(true, false)).toBe(true);
    // Constellation repliee par defaut, autres pages depliees.
    expect(resolveCollapsed(null, true)).toBe(true);
    expect(resolveCollapsed(null, false)).toBe(false);
  });
});

describe("sidebarScope", () => {
  it("page racine du monde = preference propre a la Constellation", () => {
    expect(sidebarScope(true)).toBe("constellation");
    expect(sidebarScope(false)).toBe("default");
    expect(SIDEBAR_COOKIE.constellation).not.toBe(SIDEBAR_COOKIE.default);
  });
});

describe("readCookieValue", () => {
  it("retrouve un cookie par son nom exact", () => {
    const cookies = `a=1; ${SIDEBAR_COOKIE.default}=0; ${SIDEBAR_COOKIE.constellation}=1`;
    expect(readCookieValue(cookies, SIDEBAR_COOKIE.default)).toBe("0");
    expect(readCookieValue(cookies, SIDEBAR_COOKIE.constellation)).toBe("1");
    expect(readCookieValue(cookies, "absent")).toBeNull();
    expect(readCookieValue("", SIDEBAR_COOKIE.default)).toBeNull();
  });

  it("ne confond pas un nom qui en prolonge un autre", () => {
    expect(readCookieValue(`${SIDEBAR_COOKIE.constellation}=1`, SIDEBAR_COOKIE.default)).toBeNull();
  });
});

describe("serializeSidebarCookie", () => {
  it("cookie d'un an, tout le site, SameSite=Lax, Secure en HTTPS", () => {
    expect(serializeSidebarCookie("constellation", false, false)).toBe(
      `${SIDEBAR_COOKIE.constellation}=0; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    expect(serializeSidebarCookie("default", true, true)).toBe(
      `${SIDEBAR_COOKIE.default}=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    );
  });
});
