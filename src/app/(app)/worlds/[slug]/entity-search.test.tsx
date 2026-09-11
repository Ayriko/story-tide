import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { searchEntitiesAction } from "@/actions/entity";
import type { EntitySearchResult } from "@/services/entity-service";
import { EntitySearch } from "./entity-search";

vi.mock("@/actions/entity", () => ({
  searchEntitiesAction: vi.fn(),
}));

const mockedSearchEntitiesAction = vi.mocked(searchEntitiesAction);

const ENTITIES: EntitySearchResult[] = [{ id: "e1", name: "Aeliana", type: "character" }];

function renderSearch(overrides: Partial<React.ComponentProps<typeof EntitySearch>> = {}) {
  return render(
    <EntitySearch
      worldId="w1"
      worldSlug="eldoria"
      initialEntities={ENTITIES}
      folderTree={[]}
      unfiledEntities={ENTITIES}
      {...overrides}
    />,
  );
}

// Le debounce (setTimeout) n'est simule que le temps de cet appel - jamais
// pendant un user.click() : Radix (ToggleGroup, roving focus) planifie ses
// propres setTimeout internes que seul l'ecoulement REEL du temps resout,
// et un clic sous fake timers reste bloque indefiniment sinon.
async function typeQuery(query: string) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.change(screen.getByLabelText("Rechercher une entrée"), { target: { value: query } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  vi.useRealTimers();
}

describe("EntitySearch - bascule Dossiers/Types (KAN-57)", () => {
  beforeEach(() => {
    mockedSearchEntitiesAction.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Types est la vue par defaut et affiche le regroupement existant", () => {
    renderSearch();

    expect(screen.getByRole("radio", { name: "Types", checked: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Personnages" })).toBeInTheDocument();
  });

  it("la bascule change effectivement le contenu affiche", async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.click(screen.getByRole("radio", { name: "Dossiers" }));

    expect(screen.queryByRole("button", { name: "Personnages" })).not.toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "Dossiers" })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /Non classé/ })).toBeInTheDocument();
  });

  it("recherche active + vue Types : comportement inchange (regroupe, en-tetes visibles)", async () => {
    mockedSearchEntitiesAction.mockResolvedValue({ ok: true, entities: ENTITIES });
    renderSearch();

    await typeQuery("ael");

    expect(screen.getByRole("button", { name: "Personnages" })).toBeInTheDocument();
    expect(screen.getByText("Aeliana")).toBeInTheDocument();
  });

  it("recherche active + vue Dossiers : liste plate, aucun en-tete", async () => {
    mockedSearchEntitiesAction.mockResolvedValue({ ok: true, entities: ENTITIES });
    const user = userEvent.setup();
    renderSearch();

    await user.click(screen.getByRole("radio", { name: "Dossiers" }));
    await typeQuery("ael");

    expect(screen.queryByRole("button", { name: "Personnages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByText("Aeliana")).toBeInTheDocument();
  });

  it("la bascule reste visible et cliquable pendant une recherche active, dans les deux vues", async () => {
    mockedSearchEntitiesAction.mockResolvedValue({ ok: true, entities: ENTITIES });
    const user = userEvent.setup();
    renderSearch();

    await typeQuery("ael");
    expect(screen.getByRole("radio", { name: "Types" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Dossiers" })).toBeEnabled();

    await user.click(screen.getByRole("radio", { name: "Dossiers" }));
    expect(screen.getByRole("radio", { name: "Types" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Dossiers" })).toBeEnabled();
  });
});
