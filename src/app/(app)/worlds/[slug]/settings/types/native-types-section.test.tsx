import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setNativeTypeHiddenAction, type WorldSettingsActionState } from "@/actions/world-settings";
import { NativeTypesSection } from "./native-types-section";

vi.mock("@/actions/world-settings", () => ({
  setNativeTypeHiddenAction: vi.fn(),
}));

const mockedSetHidden = vi.mocked(setNativeTypeHiddenAction);

beforeEach(() => {
  mockedSetHidden.mockReset();
});

describe("NativeTypesSection (KAN-81)", () => {
  it("un curseur « Proposer le type » par type natif, active = propose, avec le nombre d'entrees", () => {
    render(
      <NativeTypesSection
        worldId="w1"
        catalog={{ custom: [], hidden: ["prophecy"] }}
        usage={{ prophecy: 2 }}
      />,
    );

    expect(screen.getAllByRole("switch")).toHaveLength(26);
    expect(screen.getByRole("switch", { name: "Proposer le type Prophétie" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Proposer le type Personnage" })).toBeChecked();
    expect(screen.getByText("2 entrées")).toBeInTheDocument();
    expect(screen.getAllByText("Proposer le type")).toHaveLength(8);
  });

  // Non-regression : l'ancienne case a cocher controlee etait ramenee a son
  // etat de montage par la reinitialisation de formulaire de React 19 - elle
  // ne semblait basculer qu'au second clic.
  it("bascule des le premier clic, avant meme la reponse du serveur", async () => {
    let resolveAction: (state: WorldSettingsActionState) => void = () => {};
    mockedSetHidden.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<NativeTypesSection worldId="w1" catalog={{ custom: [], hidden: [] }} usage={{}} />);

    const toggle = screen.getByRole("switch", { name: "Proposer le type Note" });
    expect(toggle).toBeChecked();
    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(mockedSetHidden).toHaveBeenCalledTimes(1));
    const submitted = mockedSetHidden.mock.calls[0]?.[1];
    expect(submitted?.get("type")).toBe("note");
    expect(submitted?.get("hidden")).toBe("true");
    resolveAction({ ok: true });
  });

  it("refus du serveur : le curseur revient et le message est relie au curseur", async () => {
    mockedSetHidden.mockResolvedValueOnce({
      formError: "Au moins un type doit rester proposé dans ce monde.",
    });
    const user = userEvent.setup();
    render(<NativeTypesSection worldId="w1" catalog={{ custom: [], hidden: [] }} usage={{}} />);

    const toggle = screen.getByRole("switch", { name: "Proposer le type Note" });
    await user.click(toggle);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Au moins un type doit rester proposé dans ce monde.",
    );
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAccessibleDescription(
      "Au moins un type doit rester proposé dans ce monde.",
    );
  });

  it("au clavier : Espace sur le curseur soumet", async () => {
    mockedSetHidden.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<NativeTypesSection worldId="w1" catalog={{ custom: [], hidden: [] }} usage={{}} />);

    screen.getByRole("switch", { name: "Proposer le type Personnage" }).focus();
    await user.keyboard(" ");

    await waitFor(() => expect(mockedSetHidden).toHaveBeenCalledTimes(1));
    expect(mockedSetHidden.mock.calls[0]?.[1].get("type")).toBe("character");
  });
});
