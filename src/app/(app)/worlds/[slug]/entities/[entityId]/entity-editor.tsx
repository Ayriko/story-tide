"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor, JSONContent } from "@tiptap/core";
import { createEditorExtensions, type MentionSuggestionItem } from "@/lib/tiptap-extensions";
import { createLinkHighlightExtension, MENTION_TARGET_ATTR } from "@/lib/tiptap-link-highlight";
import type { Pattern } from "@/lib/linker/aho-corasick";
import { saveEntityContentAction } from "@/actions/entity-content";
import { uploadImageAction } from "@/actions/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMentionSuggestion } from "./mention-suggestion";

const AUTOSAVE_DEBOUNCE_MS = 1500;

type SaveStatus = "idle" | "saving" | "saved" | "error";

type ActiveState = {
  heading2: boolean;
  heading3: boolean;
  bold: boolean;
  italic: boolean;
  blockquote: boolean;
  bulletList: boolean;
  orderedList: boolean;
  link: boolean;
};

const INACTIVE_STATE: ActiveState = {
  heading2: false,
  heading3: false,
  bold: false,
  italic: false,
  blockquote: false,
  bulletList: false,
  orderedList: false,
  link: false,
};

const toolbarButtonBase =
  "rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
const toolbarButtonActive = "border-primary bg-primary text-primary-foreground";
const toolbarButtonInactive = "border-input text-foreground hover:bg-accent";

function ToolbarButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${toolbarButtonBase} ${active ? toolbarButtonActive : toolbarButtonInactive}`}
    >
      {label}
    </button>
  );
}

function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function apply() {
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    }
    setOpen(false);
    setUrl("");
  }

  return (
    <div className="relative">
      <ToolbarButton label="Lien" active={active} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div className="absolute left-0 top-full z-10 mt-1 flex gap-2 rounded-md border border-border bg-popover p-2">
          <Label className="sr-only" htmlFor="link-url">
            URL du lien
          </Label>
          <Input
            id="link-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            className="h-9 w-48"
          />
          <Button type="button" variant="secondary" size="sm" onClick={apply}>
            Appliquer
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Deux facons de fournir l'image : URL manuelle (inchange) OU un fichier
// choisi, uploade vers MinIO au clic "Inserer" (pas au choix du fichier -
// evite l'upload orphelin d'un fichier choisi puis jamais insere, KAN-16).
// Si un fichier est choisi, il prend le pas sur l'URL saisie.
function ImageControl({ editor, worldId }: { editor: Editor; worldId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInsert = (file !== null || url.trim() !== "") && alt.trim() !== "" && !uploading;

  function reset() {
    setOpen(false);
    setUrl("");
    setAlt("");
    setFile(null);
    setError(null);
  }

  async function apply() {
    if (!canInsert) {
      return;
    }
    if (file) {
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadImageAction(worldId, formData);
      setUploading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      editor.chain().focus().setImage({ src: result.src, alt: alt.trim() }).run();
      reset();
      return;
    }
    editor.chain().focus().setImage({ src: url.trim(), alt: alt.trim() }).run();
    reset();
  }

  return (
    <div className="relative">
      <ToolbarButton label="Image" onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div className="absolute left-0 top-full z-10 mt-1 flex flex-col gap-2 rounded-md border border-border bg-popover p-2">
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-1">
            <Label htmlFor="image-file">Téléverser une image</Label>
            <input
              id="image-file"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-56 text-xs text-muted-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="image-url">…ou URL de l&apos;image</Label>
            <Input
              id="image-url"
              type="url"
              value={url}
              disabled={file !== null}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              className="h-9 w-56"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="image-alt">Texte alternatif</Label>
            <Input
              id="image-alt"
              type="text"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              className="h-9 w-56"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void apply()}
            disabled={!canInsert}
            aria-busy={uploading}
          >
            {uploading ? "Envoi…" : "Insérer"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Toolbar({
  editor,
  active,
  worldId,
}: {
  editor: Editor;
  active: ActiveState;
  worldId: string;
}) {
  return (
    <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap gap-1.5">
      <ToolbarButton
        label="Titre"
        active={active.heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Sous-titre"
        active={active.heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarButton
        label="Gras"
        active={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italique"
        active={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Citation"
        active={active.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Liste à puces"
        active={active.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Liste numérotée"
        active={active.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <LinkControl editor={editor} active={active.link} />
      <ImageControl editor={editor} worldId={worldId} />
    </div>
  );
}

export function EntityEditor({
  worldId,
  worldSlug,
  entityId,
  initialContent,
  dictionary,
  ignoredTargetIds,
  entities,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
  initialContent: JSONContent;
  dictionary: Pattern[];
  ignoredTargetIds: string[];
  entities: MentionSuggestionItem[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (content: JSONContent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setStatus("saving");
        // JSON.stringify avant la frontiere Server Action : voir le
        // commentaire de saveEntityContentAction (erreur de serialisation
        // Next.js sur l'objet imbrique passe en argument positionnel brut).
        void saveEntityContentAction(worldId, entityId, JSON.stringify(content)).then((result) => {
          setStatus(result.ok ? "saved" : "error");
          setErrorMessage(result.ok ? null : result.error);
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [worldId, entityId],
  );

  // Exclut la fiche courante de ses propres suggestions @ - une auto-mention
  // n'a pas de sens (meme raisonnement que selfEntityId pour le surlignage
  // AUTO, resolveLinks.ts).
  const mentionableEntities = entities.filter((entity) => entity.id !== entityId);

  // Fabrique appelee ici (pas un tableau importe partage) : chaque montage de
  // ce composant recoit ses propres instances d'extension - necessaire sous
  // React StrictMode (dev), qui monte/demonte/remonte une fois pour detecter
  // les effets non idempotents. Partager les memes instances entre deux
  // montages corrompait les commandes liees au schema (titre, listes,
  // citation, lien, image) - seuls les marks simples (gras/italique) survivaient.
  // createLinkHighlightExtension suit la meme regle (dictionnaire fige au
  // montage - voir son commentaire dans tiptap-link-highlight.ts).
  const editor = useEditor({
    extensions: [
      ...createEditorExtensions(createMentionSuggestion(mentionableEntities)),
      createLinkHighlightExtension({ dictionary, selfEntityId: entityId, ignoredTargetIds }),
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      scheduleSave(updatedEditor.getJSON());
    },
  });

  // editor.isActive(...) reflete l'etat reel de l'editeur, mais rien n'oblige
  // React a re-rendre le toolbar quand la selection/transaction change - seul
  // un state React qui change (ex. setStatus au bout de 1,5s) le ferait,
  // d'ou un delai visuel percu sur les boutons actifs alors que le formatage
  // s'applique reellement tout de suite (vue interne ProseMirror, independante
  // de React). useEditorState s'abonne aux transactions de l'editeur et ne
  // re-rend que si la valeur selectionnee change vraiment.
  const active = useEditorState({
    editor,
    selector: ({ editor: currentEditor }): ActiveState => {
      if (!currentEditor) {
        return INACTIVE_STATE;
      }
      return {
        heading2: currentEditor.isActive("heading", { level: 2 }),
        heading3: currentEditor.isActive("heading", { level: 3 }),
        bold: currentEditor.isActive("bold"),
        italic: currentEditor.isActive("italic"),
        blockquote: currentEditor.isActive("blockquote"),
        bulletList: currentEditor.isActive("bulletList"),
        orderedList: currentEditor.isActive("orderedList"),
        link: currentEditor.isActive("link"),
      };
    },
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Clic simple = edition normale (placer le curseur dans le contenteditable) ;
  // Ctrl/Cmd+clic sur une mention surlignee = navigation vers la fiche liee.
  // Convention deja etablie par les editeurs/IDE (VS Code...), pour ne jamais
  // gener la correction du texte d'un mot lie. La liste "Entites liees" sous
  // l'editeur reste le chemin clavier/lecteur d'ecran (RGAA).
  const handleMentionClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      const mentionElement = (event.target as HTMLElement).closest(`[${MENTION_TARGET_ATTR}]`);
      if (!mentionElement) {
        return;
      }
      const targetId = mentionElement.getAttribute(MENTION_TARGET_ATTR);
      if (!targetId) {
        return;
      }
      event.preventDefault();
      router.push(`/worlds/${worldSlug}/entities/${targetId}`);
    },
    [router, worldSlug],
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <Toolbar editor={editor} active={active ?? INACTIVE_STATE} worldId={worldId} />
      <EditorContent
        editor={editor}
        onClickCapture={handleMentionClick}
        // Tiptap est headless : aucun style natif. Tailwind Preflight reinitialise
        // en plus la taille des titres et les puces des listes - sans ces regles,
        // un titre/une liste/une citation sont invisibles a l'oeil meme si le node
        // est bien applique (verifie via le JSON sauvegarde).
        // Surlignage des mentions liees (tiptap-link-highlight.ts) : souligne
        // pointille discret, jamais du texte plein (ne doit pas se confondre
        // avec un vrai lien "http" du node Link). Ctrl/Cmd+clic navigue
        // (handleMentionClick) ; sans modificateur, clic simple = edition.
        className="min-h-[200px] rounded-md border border-input px-3 py-2 text-sm text-foreground focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring [&_.ProseMirror]:outline-none [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-medium [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-heading [&_h3]:text-lg [&_h3]:font-medium [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_.entity-mention]:cursor-pointer [&_.entity-mention]:underline [&_.entity-mention]:decoration-dotted [&_.entity-mention]:decoration-muted-foreground [&_.entity-mention]:underline-offset-2"
      />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {status === "saving" ? "Enregistrement…" : null}
        {status === "saved" ? "Enregistré." : null}
        {status === "error" ? (errorMessage ?? "Erreur d'enregistrement.") : null}
      </p>
    </div>
  );
}
