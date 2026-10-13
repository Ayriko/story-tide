import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { AdminNav } from "./admin-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

function currentLinks(): string[] {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent ?? "");
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AdminNav", () => {
  it("expose les deux sections dans une navigation nommee", () => {
    mockedUsePathname.mockReturnValue("/admin");
    render(<AdminNav />);

    expect(screen.getByRole("navigation", { name: "Sections d'administration" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Utilisateurs" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });

  it("marque le tableau de bord seul sur /admin", () => {
    mockedUsePathname.mockReturnValue("/admin");
    render(<AdminNav />);

    expect(currentLinks()).toEqual(["Tableau de bord"]);
  });

  it("marque Utilisateurs seul sur la liste", () => {
    mockedUsePathname.mockReturnValue("/admin/users");
    render(<AdminNav />);

    expect(currentLinks()).toEqual(["Utilisateurs"]);
  });

  it("garde Utilisateurs marque sur une fiche", () => {
    mockedUsePathname.mockReturnValue("/admin/users/abc");
    render(<AdminNav />);

    expect(currentLinks()).toEqual(["Utilisateurs"]);
  });
});
