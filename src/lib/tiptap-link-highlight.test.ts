import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./tiptap-extensions";
import { createMentionHighlightPlugin, mentionHighlightPluginKey } from "./tiptap-link-highlight";

// Meme schema que l'editeur reel/la validation serveur (cf.
// tiptap-positions.test.ts) - construit ici pour batir des EditorState reels.
const schema = getSchema(createEditorExtensions());

function makeDoc(json: JSONContent): ProseMirrorNode {
  return ProseMirrorNode.fromJSON(schema, json);
}

interface DecorationSnapshot {
  from: number;
  to: number;
  targetId: unknown;
  text: string;
}

// `decoration.spec` est la seule partie publique typee de Decoration (le
// champ `type.attrs` reel n'est pas expose par les types @tiptap/pm/view) -
// tiptap-link-highlight.ts y duplique le targetId pour cette raison.
function decorationsOf(state: EditorState): DecorationSnapshot[] {
  const set = mentionHighlightPluginKey.getState(state);
  if (!set) {
    return [];
  }
  return set.find().map((deco) => ({
    from: deco.from,
    to: deco.to,
    targetId: (deco.spec as { targetId: unknown }).targetId,
    text: state.doc.textBetween(deco.from, deco.to),
  }));
}

describe("createMentionHighlightPlugin", () => {
  it("surligne une mention connue du dictionnaire", () => {
    const doc = makeDoc({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Le roi Aldric regne ici." }] },
      ],
    });
    const plugin = createMentionHighlightPlugin({
      dictionary: [{ entityId: "e1", term: "Aldric" }],
      selfEntityId: "src1",
      ignoredTargetIds: [],
    });
    const state = EditorState.create({ schema, doc, plugins: [plugin] });

    expect(decorationsOf(state)).toEqual([{ from: 8, to: 14, targetId: "e1", text: "Aldric" }]);
  });

  it("n'affiche aucune decoration sans dictionnaire", () => {
    const doc = makeDoc({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Aldric regne." }] }],
    });
    const plugin = createMentionHighlightPlugin({
      dictionary: [],
      selfEntityId: "src1",
      ignoredTargetIds: [],
    });
    const state = EditorState.create({ schema, doc, plugins: [plugin] });

    expect(decorationsOf(state)).toEqual([]);
  });

  it("exclut l'auto-mention (la fiche qui contient son propre nom)", () => {
    const doc = makeDoc({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Aldric est le roi." }] }],
    });
    const plugin = createMentionHighlightPlugin({
      dictionary: [{ entityId: "src1", term: "Aldric" }],
      selfEntityId: "src1",
      ignoredTargetIds: [],
    });
    const state = EditorState.create({ schema, doc, plugins: [plugin] });

    expect(decorationsOf(state)).toEqual([]);
  });

  it("respecte les cibles ignorees (LinkIgnore)", () => {
    const doc = makeDoc({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Aldric regne." }] }],
    });
    const plugin = createMentionHighlightPlugin({
      dictionary: [{ entityId: "e1", term: "Aldric" }],
      selfEntityId: "src1",
      ignoredTargetIds: ["e1"],
    });
    const state = EditorState.create({ schema, doc, plugins: [plugin] });

    expect(decorationsOf(state)).toEqual([]);
  });

  it("occurrence ambigue (deux entites homonymes) : aucune decoration", () => {
    const doc = makeDoc({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Aldric regne." }] }],
    });
    const plugin = createMentionHighlightPlugin({
      dictionary: [
        { entityId: "e1", term: "Aldric" },
        { entityId: "e2", term: "Aldric" },
      ],
      selfEntityId: "src1",
      ignoredTargetIds: [],
    });
    const state = EditorState.create({ schema, doc, plugins: [plugin] });

    expect(decorationsOf(state)).toEqual([]);
  });

  it("re-scanne quand une transaction modifie le document (frappe en direct)", () => {
    const doc = makeDoc({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Rien ici." }] }],
    });
    const plugin = createMentionHighlightPlugin({
      dictionary: [{ entityId: "e1", term: "Aldric" }],
      selfEntityId: "src1",
      ignoredTargetIds: [],
    });
    let state = EditorState.create({ schema, doc, plugins: [plugin] });
    expect(decorationsOf(state)).toEqual([]);

    // Position 1 = juste apres l'ouverture du paragraphe (debut du texte).
    const tr = state.tr.insertText("Aldric ", 1);
    state = state.apply(tr);

    expect(decorationsOf(state)).toEqual([{ from: 1, to: 7, targetId: "e1", text: "Aldric" }]);
  });

  it("ne recalcule pas quand la transaction ne modifie pas le document (selection)", () => {
    const doc = makeDoc({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Le roi Aldric regne ici." }] },
      ],
    });
    const plugin = createMentionHighlightPlugin({
      dictionary: [{ entityId: "e1", term: "Aldric" }],
      selfEntityId: "src1",
      ignoredTargetIds: [],
    });
    let state = EditorState.create({ schema, doc, plugins: [plugin] });
    const before = decorationsOf(state);

    const tr = state.tr.setSelection(TextSelection.atEnd(state.doc));
    state = state.apply(tr);

    expect(decorationsOf(state)).toEqual(before);
  });
});
