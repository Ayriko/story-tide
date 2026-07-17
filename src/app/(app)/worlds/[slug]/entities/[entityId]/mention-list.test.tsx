import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MentionSuggestionItem } from "@/lib/tiptap-extensions";
import { MentionList, type MentionListHandle, mentionOptionId } from "./mention-list";

const ITEMS: MentionSuggestionItem[] = [
  { id: "e1", label: "Aeliana" },
  { id: "e2", label: "Robert" },
];

// editor.view.dom est le seul champ reellement lu par MentionList
// (aria-activedescendant) - un vrai element DOM suffit, pas besoin du reste
// de la forme Editor (cast justifie, meme convention que auth-session.test.ts).
function fakeEditor() {
  return { view: { dom: document.createElement("div") } } as unknown as SuggestionProps<
    MentionSuggestionItem,
    MentionSuggestionItem
  >["editor"];
}

function Harness({
  items,
  command,
  onHandle,
}: {
  items: MentionSuggestionItem[];
  command: (item: MentionSuggestionItem) => void;
  onHandle?: (handle: MentionListHandle | null) => void;
}) {
  return (
    <MentionList
      // Ref callback : seul moyen d'observer le handle imperatif depuis le
      // test (render() de Testing Library flush les effets/commits avant de
      // retourner - le handle est deja disponible juste apres l'appel).
      ref={(handle) => onHandle?.(handle)}
      items={items}
      command={command}
      editor={fakeEditor()}
      query=""
      text="@"
      range={{ from: 0, to: 1 }}
      decorationNode={null}
      placement="bottom-start"
      offset={{ mainAxis: 4, crossAxis: 0 }}
      flip
      floatingUi={{ placement: "bottom-start", strategy: "absolute", middleware: [] }}
      mount={() => () => {}}
      loading={false}
    />
  );
}

function keyboardEvent(key: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { key });
}

describe("MentionList", () => {
  it("affiche chaque entite comme une option accessible", () => {
    render(<Harness items={ITEMS} command={vi.fn()} />);

    const listbox = screen.getByRole("listbox", { name: "Entités correspondantes" });
    const options = screen.getAllByRole("option");
    expect(listbox).toBeInTheDocument();
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Aeliana");
    expect(options[1]).toHaveTextContent("Robert");
  });

  it("affiche un etat vide quand aucune entite ne correspond", () => {
    render(<Harness items={[]} command={vi.fn()} />);

    expect(screen.getByText("Aucune entité trouvée.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("la premiere option est selectionnee par defaut", () => {
    render(<Harness items={ITEMS} command={vi.fn()} />);

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("le clic sur une option appelle command avec cette entite", async () => {
    const command = vi.fn();
    const user = userEvent.setup();
    render(<Harness items={ITEMS} command={command} />);

    await user.click(screen.getByRole("option", { name: "Robert" }));

    expect(command).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("ArrowDown/ArrowUp deplace la selection avec bouclage, Enter valide", () => {
    const command = vi.fn();
    let handle: MentionListHandle | null = null;
    render(<Harness items={ITEMS} command={command} onHandle={(h) => (handle = h)} />);

    expect(handle).not.toBeNull();
    // Relit `handle` a CHAQUE appel (jamais une reference mise en cache) :
    // useImperativeHandle expose un nouvel objet a chaque rendu (selectedIndex
    // change), exactement comme le plugin Suggestion relit toujours
    // `component.ref` (jamais une copie) avant d'appeler onKeyDown. act() est
    // necessaire car onKeyDown declenche setSelectedIndex en dehors de tout
    // gestionnaire d'evenement DOM reel (appel direct au handle imperatif).
    function pressKey(key: string): boolean {
      let handled = false;
      act(() => {
        handled = (handle as unknown as MentionListHandle).onKeyDown({
          event: keyboardEvent(key),
        } as Parameters<MentionListHandle["onKeyDown"]>[0]);
      });
      return handled;
    }

    expect(pressKey("ArrowDown")).toBe(true);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    // Boucle de la derniere a la premiere option.
    expect(pressKey("ArrowDown")).toBe(true);
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");

    expect(pressKey("ArrowUp")).toBe(true);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    expect(pressKey("Enter")).toBe(true);
    expect(command).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("ne gere pas les autres touches (laisse le plugin Suggestion decider, ex. Echap)", () => {
    let handle: MentionListHandle | null = null;
    render(<Harness items={ITEMS} command={vi.fn()} onHandle={(h) => (handle = h)} />);

    const list = handle as unknown as MentionListHandle;
    const handled = list.onKeyDown({
      event: keyboardEvent("Escape"),
    } as Parameters<MentionListHandle["onKeyDown"]>[0]);

    expect(handled).toBe(false);
  });

  it("pose aria-activedescendant sur le DOM de l'editeur, aligne sur l'option selectionnee", () => {
    const editor = fakeEditor();
    render(
      <MentionList
        ref={() => {}}
        items={ITEMS}
        command={vi.fn()}
        editor={editor}
        query=""
        text="@"
        range={{ from: 0, to: 1 }}
        decorationNode={null}
        placement="bottom-start"
        offset={{ mainAxis: 4, crossAxis: 0 }}
        flip
        floatingUi={{ placement: "bottom-start", strategy: "absolute", middleware: [] }}
        mount={() => () => {}}
        loading={false}
      />,
    );

    expect(editor.view.dom.getAttribute("aria-activedescendant")).toBe(mentionOptionId("e1"));
  });
});
