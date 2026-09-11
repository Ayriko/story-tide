import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateFolderForm } from "./create-folder-form";
import { createFolderAction } from "@/actions/folder";

vi.mock("@/actions/folder", () => ({
  createFolderAction: vi.fn(),
}));

const mockedCreateFolderAction = vi.mocked(createFolderAction);

describe("CreateFolderForm", () => {
  beforeEach(() => {
    mockedCreateFolderAction.mockReset();
  });

  it("associe le label natif au champ nom", () => {
    render(<CreateFolderForm worldId="w1" parentId={null} onSuccess={vi.fn()} />);

    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
  });

  it("appelle onSuccess apres une soumission reussie (pas d'erreur, pas d'effet)", async () => {
    mockedCreateFolderAction.mockResolvedValue({});
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<CreateFolderForm worldId="w1" parentId={null} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Nom"), "Royaumes");
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("affiche une erreur de champ et n'appelle jamais onSuccess", async () => {
    mockedCreateFolderAction.mockResolvedValue({ errors: { name: "Le nom est requis." } });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<CreateFolderForm worldId="w1" parentId={null} onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: "Créer" }));

    await screen.findByText("Le nom est requis.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("affiche une erreur generique (role=alert) et n'appelle jamais onSuccess", async () => {
    mockedCreateFolderAction.mockResolvedValue({
      formError: "Création impossible pour le moment. Réessayez.",
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<CreateFolderForm worldId="w1" parentId="f1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Nom"), "Nord");
    await user.click(screen.getByRole("button", { name: "Créer" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Création impossible pour le moment. Réessayez.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("transmet worldId et parentId (chaine vide si null) dans le FormData soumis", async () => {
    mockedCreateFolderAction.mockResolvedValue({});
    const user = userEvent.setup();
    render(<CreateFolderForm worldId="w1" parentId={null} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Nom"), "Royaumes");
    await user.click(screen.getByRole("button", { name: "Créer" }));

    const submitted = mockedCreateFolderAction.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("worldId")).toBe("w1");
    expect(submitted.get("parentId")).toBe("");
    expect(submitted.get("name")).toBe("Royaumes");
  });
});
