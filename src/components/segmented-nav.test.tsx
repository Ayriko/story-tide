import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { Settings, Tags } from "lucide-react";
import { SegmentedNav, type SegmentedNavSection } from "./segmented-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

const SECTIONS: SegmentedNavSection[] = [
  { href: "/root", label: "Racine", icon: Settings, exact: true },
  { href: "/root/sub", label: "Sous-section", icon: Tags },
];

function currentLinks(): string[] {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent ?? "");
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SegmentedNav", () => {
  it("rend une navigation nommee avec un lien par section", () => {
    mockedUsePathname.mockReturnValue("/root");
    render(<SegmentedNav ariaLabel="Sections de test" sections={SECTIONS} />);

    expect(screen.getByRole("navigation", { name: "Sections de test" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Racine" })).toHaveAttribute("href", "/root");
    expect(screen.getByRole("link", { name: "Sous-section" })).toHaveAttribute("href", "/root/sub");
  });

  it("section exacte : courante seulement sur egalite stricte", () => {
    mockedUsePathname.mockReturnValue("/root/sub/detail");
    render(<SegmentedNav ariaLabel="Sections de test" sections={SECTIONS} />);

    expect(currentLinks()).toEqual(["Sous-section"]);
  });

  it("aucune section courante hors des routes connues", () => {
    mockedUsePathname.mockReturnValue("/ailleurs");
    render(<SegmentedNav ariaLabel="Sections de test" sections={SECTIONS} />);

    expect(currentLinks()).toEqual([]);
  });
});
