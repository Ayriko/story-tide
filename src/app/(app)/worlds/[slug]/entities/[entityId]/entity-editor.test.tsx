import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { createEditorExtensions } from "@/lib/tiptap-extensions";
import { MENTION_TARGET_ATTR } from "@/lib/tiptap-link-highlight";
import { LinkControl, resolveEditorClickTarget } from "./entity-editor";

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
