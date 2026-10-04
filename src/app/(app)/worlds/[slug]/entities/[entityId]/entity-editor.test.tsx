import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEditor, useEditorState } from "@tiptap/react";
import type { Editor, TiptapEditorHTMLElement } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { getEntityScanStatusAction, saveEntityContentAction } from "@/actions/entity-content";
import { createEditorExtensions } from "@/lib/tiptap-extensions";
import { MENTION_TARGET_ATTR } from "@/lib/tiptap-link-highlight";
import { EntityEditor, LinkControl, resolveEditorClickTarget } from "./entity-editor";

// Polling du statut de scan (KAN-77) : EntityEditor appelle deux Server
// Actions et le router - mockes pour tout le fichier, sans effet sur les
// tests LinkControl/resolveEditorClickTarget qui n'y touchent jamais.
// @/actions/image aussi : importe par entity-editor.tsx, il tirerait sinon
// la vraie couche service/Prisma.
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/actions/entity-content", () => ({
  saveEntityContentAction: vi.fn(),
  getEntityScanStatusAction: vi.fn(),
}));
vi.mock("@/actions/image", () => ({ uploadImageAction: vi.fn() }));

// BUG-015 : le bouton "Lien" n'avait aucun effet ni retour quand aucun texte
// n'etait selectionne, ou quand l'URL echouait la validation (isAllowedUri) -
// setLink().run() renvoie alors false sans que LinkControl ne le lise. Ces
// tests montent un vrai Editor Tiptap (memes extensions que la production,
// via createEditorExtensions) pour exercer les vraies commandes/validations,
// mais ne rendent pas <EditorContent> - seul LinkControl est sous test, d'ou
// l'exposition de l'editeur via onReady plutot que par le DOM du document.
function Harness({ onReady }: { onReady: (editor: Editor) => void }) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: "<p>Bonjour le monde</p>",
    immediatelyRender: false,
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor?.isActive("link") ?? false,
  });

  useEffect(() => {
    if (editor) {
      onReady(editor);
    }
  }, [editor, onReady]);

  if (!editor) {
    return null;
  }
  return <LinkControl editor={editor} active={active ?? false} />;
}

async function renderHarness() {
  let editor: Editor | null = null;
  render(<Harness onReady={(readyEditor) => (editor = readyEditor)} />);
  await screen.findByRole("button", { name: "Lien" });
  if (!editor) {
    throw new Error("editor non initialise");
  }
  return editor as Editor;
}

describe("LinkControl (BUG-015)", () => {
  it("desactive Appliquer et explique pourquoi quand aucun texte n'est selectionne", async () => {
    const user = userEvent.setup();
    await renderHarness();

    await user.click(screen.getByRole("button", { name: "Lien" }));
    const applyButton = await screen.findByRole("button", { name: "Appliquer" });

    expect(applyButton).toBeDisabled();
    expect(
      screen.getByText("Sélectionnez du texte dans l'éditeur avant d'appliquer un lien."),
    ).toBeInTheDocument();
  });

  it("affiche une erreur accessible et n'applique rien quand l'URL est invalide", async () => {
    const user = userEvent.setup();
    const editor = await renderHarness();
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 8 }); // "Bonjour"
    });

    await user.click(screen.getByRole("button", { name: "Lien" }));
    const applyButton = await screen.findByRole("button", { name: "Appliquer" });
    expect(applyButton).toBeEnabled();

    await user.type(screen.getByLabelText("URL du lien"), "example.com");
    await user.click(applyButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(/URL invalide/);
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeInTheDocument(); // dialogue toujours ouvert
    expect(editor.isActive("link")).toBe(false);
  });

  it("applique le lien quand du texte est selectionne et l'URL est valide", async () => {
    const user = userEvent.setup();
    const editor = await renderHarness();
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 8 }); // "Bonjour"
    });

    await user.click(screen.getByRole("button", { name: "Lien" }));
    const applyButton = await screen.findByRole("button", { name: "Appliquer" });
    expect(applyButton).toBeEnabled();

    await user.type(screen.getByLabelText("URL du lien"), "https://example.com");
    await user.click(applyButton);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(editor.getHTML()).toContain('href="https://example.com"');
  });
});

// Ctrl/Cmd+clic sur un vrai lien (BUG-015, retour direct d'Aymeric) : Chrome
// suspend la navigation native d'un <a> dans un contenteditable sur un clic
// simple, seul le clic droit natif "Ouvrir le lien" passait outre jusqu'ici.
describe("resolveEditorClickTarget (BUG-015)", () => {
  it("ne renvoie rien sur un element sans mention ni lien", () => {
    const span = document.createElement("span");
    document.body.append(span);

    expect(resolveEditorClickTarget(span)).toBeNull();
  });

  it("reconnait une mention surlignee via son attribut cible", () => {
    const container = document.createElement("div");
    container.innerHTML = `<span ${MENTION_TARGET_ATTR}="entity-1"><em>Nom</em></span>`;
    document.body.append(container);
    const innerEm = container.querySelector("em") as HTMLElement;

    expect(resolveEditorClickTarget(innerEm)).toEqual({ type: "mention", targetId: "entity-1" });
  });

  it("reconnait un vrai lien <a href> et resout son URL absolue", () => {
    const container = document.createElement("div");
    container.innerHTML = `<a href="https://example.com"><strong>texte</strong></a>`;
    document.body.append(container);
    const innerStrong = container.querySelector("strong") as HTMLElement;

    expect(resolveEditorClickTarget(innerStrong)).toEqual({
      type: "link",
      href: "https://example.com/",
    });
  });
});

// KAN-77 : apres un save reussi, l'editeur interroge getEntityScanStatusAction
// jusqu'a scannedVersion >= contentVersion avant de rafraichir "Renvois".
// Vrai EntityEditor monte (vraies extensions Tiptap) ; le contenu est modifie
// via l'instance Editor exposee par Tiptap sur le DOM (.ProseMirror.editor),
// meme chemin onUpdate -> scheduleSave qu'une frappe reelle.
describe("EntityEditor - attente du scan de liaison (KAN-77)", () => {
  const PENDING_NOTE = "Mise à jour des liens détectés…";
  const mockedSave = vi.mocked(saveEntityContentAction);
  const mockedScanStatus = vi.mocked(getEntityScanStatusAction);
  const refresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset (pas seulement clearAllMocks) : vide aussi les reponses
    // mockResolvedValueOnce restees en file si un test precedent echoue tot -
    // sinon elles fuient dans le test suivant.
    mockedSave.mockReset();
    mockedScanStatus.mockReset();
    vi.mocked(useRouter).mockReturnValue({
      refresh,
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderEditor() {
    const view = render(
      <EntityEditor
        worldId="w1"
        worldSlug="monde"
        entityId="e1"
        initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
        dictionary={[]}
        ignoredTargetIds={[]}
        entities={[]}
      />,
    );
    await screen.findByRole("toolbar", { name: "Mise en forme" });
    const dom = view.container.querySelector<TiptapEditorHTMLElement>(".ProseMirror");
    if (!dom?.editor) {
      throw new Error("editeur Tiptap non monte");
    }
    // Timers simules seulement une fois l'editeur monte : le montage
    // (immediatelyRender: false) reste sur les vrais timers.
    vi.useFakeTimers();
    return { ...view, editor: dom.editor };
  }

  // Une modification + le debounce d'auto-save (1,5 s) + resolution du save.
  async function editAndSave(editor: Editor, text: string) {
    act(() => {
      editor.commands.insertContent(text);
    });
    await act(() => vi.advanceTimersByTimeAsync(1_500));
  }

  async function advance(ms: number) {
    await act(() => vi.advanceTimersByTimeAsync(ms));
  }

  it("rafraichit tout de suite, puis une seconde fois quand scannedVersion atteint la version sauvegardee", async () => {
    mockedSave.mockResolvedValueOnce({ ok: true, contentVersion: 3 });
    mockedScanStatus
      .mockResolvedValueOnce({ ok: true, scannedVersion: 2 })
      .mockResolvedValueOnce({ ok: true, scannedVersion: 3 });
    const { editor } = await renderEditor();

    await editAndSave(editor, "Aldric");

    // Refresh immediat (mentions MANUAL) + note affichee, aucune interrogation encore.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(PENDING_NOTE)).toBeInTheDocument();
    expect(mockedScanStatus).not.toHaveBeenCalled();

    await advance(1_000); // 1re interrogation : 2 < 3, on continue
    expect(mockedScanStatus).toHaveBeenCalledWith("w1", "e1");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(PENDING_NOTE)).toBeInTheDocument();

    await advance(1_000); // 2e interrogation : 3 >= 3, termine
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(PENDING_NOTE)).not.toBeInTheDocument();

    await advance(10_000); // plus aucune interrogation apres la confirmation
    expect(mockedScanStatus).toHaveBeenCalledTimes(2);
  });

  it("abandonne apres 10 interrogations : refresh, note retiree, console.warn - jamais un echec avale", async () => {
    mockedSave.mockResolvedValueOnce({ ok: true, contentVersion: 5 });
    mockedScanStatus.mockResolvedValue({ ok: true, scannedVersion: 4 });
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { editor } = await renderEditor();

    await editAndSave(editor, "Aldric");
    await advance(9_000);
    expect(mockedScanStatus).toHaveBeenCalledTimes(9);
    expect(screen.getByText(PENDING_NOTE)).toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalled();

    await advance(1_000);
    expect(mockedScanStatus).toHaveBeenCalledTimes(10);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(PENDING_NOTE)).not.toBeInTheDocument();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("Scan de liaison non confirmé"),
      { entityId: "e1", targetVersion: 5, scannedVersion: 4 },
    );

    await advance(10_000);
    expect(mockedScanStatus).toHaveBeenCalledTimes(10);
    consoleWarn.mockRestore();
  });

  it("un nouveau save annule le polling en cours et se cale sur la version du DERNIER save", async () => {
    mockedSave
      .mockResolvedValueOnce({ ok: true, contentVersion: 1 })
      .mockResolvedValueOnce({ ok: true, contentVersion: 2 });
    mockedScanStatus
      .mockResolvedValueOnce({ ok: true, scannedVersion: 0 }) // polling du save 1 : 0 < 1
      .mockResolvedValueOnce({ ok: true, scannedVersion: 1 }) // polling du save 2 : 1 < 2
      .mockResolvedValueOnce({ ok: true, scannedVersion: 2 });
    const { editor } = await renderEditor();

    // Chronologie (t = 0 a la resolution du save 1) : la frappe suivante
    // arme un debounce de 1,5 s, plus long que l'intervalle de polling
    // (1 s) - le save 1 est donc interroge une fois a t = 1 s, puis le save 2
    // part a t = 1,5 s et annule l'interrogation prevue a t = 2 s. C'est le
    // SAVE qui annule le polling, pas la frappe.
    await editAndSave(editor, "Ald");
    await editAndSave(editor, "ric");
    expect(mockedSave).toHaveBeenCalledTimes(2);
    expect(mockedScanStatus).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(2); // refresh immediat de chaque save

    // t = 2 s : l'interrogation du save 1 a bien ete annulee (sinon 2 appels ici).
    await advance(500);
    expect(mockedScanStatus).toHaveBeenCalledTimes(1);

    // t = 2,5 s : 1re interrogation du save 2 - scannedVersion 1 aurait suffi
    // au save 1, pas au save 2 : la note reste, pas de refresh.
    await advance(500);
    expect(mockedScanStatus).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(PENDING_NOTE)).toBeInTheDocument();

    await advance(1_000); // 2 >= 2 : termine
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(PENDING_NOTE)).not.toBeInTheDocument();
  });

  it("s'arrete tout de suite sur une reponse en erreur (session expiree, introuvable) avec console.warn", async () => {
    mockedSave.mockResolvedValueOnce({ ok: true, contentVersion: 1 });
    mockedScanStatus.mockResolvedValueOnce({ ok: false, error: "Entrée introuvable." });
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { editor } = await renderEditor();

    await editAndSave(editor, "Aldric");
    await advance(1_000);

    expect(consoleWarn).toHaveBeenCalledWith(
      "[entity-editor] Statut de liaison illisible :",
      "Entrée introuvable.",
    );
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(PENDING_NOTE)).not.toBeInTheDocument();
    await advance(10_000);
    expect(mockedScanStatus).toHaveBeenCalledTimes(1);
    consoleWarn.mockRestore();
  });

  it("logue l'erreur reelle si l'interrogation echoue (promesse rejetee)", async () => {
    mockedSave.mockResolvedValueOnce({ ok: true, contentVersion: 1 });
    const networkError = new Error("reseau coupe");
    mockedScanStatus.mockRejectedValueOnce(networkError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { editor } = await renderEditor();

    await editAndSave(editor, "Aldric");
    await advance(1_000);

    expect(consoleError).toHaveBeenCalledWith(
      "[entity-editor] Interrogation du statut de liaison échouée :",
      networkError,
    );
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(PENDING_NOTE)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("n'interroge pas et n'affiche pas la note quand le save echoue", async () => {
    mockedSave.mockResolvedValueOnce({ ok: false, error: "Contenu invalide." });
    const { editor } = await renderEditor();

    await editAndSave(editor, "Aldric");
    await advance(10_000);

    expect(screen.getByText("Contenu invalide.")).toBeInTheDocument();
    expect(screen.queryByText(PENDING_NOTE)).not.toBeInTheDocument();
    expect(mockedScanStatus).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("demontage : plus aucune interrogation ni refresh", async () => {
    mockedSave.mockResolvedValueOnce({ ok: true, contentVersion: 1 });
    mockedScanStatus.mockResolvedValue({ ok: true, scannedVersion: 0 });
    const { editor, unmount } = await renderEditor();

    await editAndSave(editor, "Aldric");
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    await advance(20_000);

    expect(mockedScanStatus).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
