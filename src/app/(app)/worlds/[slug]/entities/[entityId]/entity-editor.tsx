"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { EditorContent, ReactNodeViewRenderer, useEditor, useEditorState } from "@tiptap/react";
import type { Editor, JSONContent } from "@tiptap/core";
import { createEditorExtensions, type MentionSuggestionItem } from "@/lib/tiptap-extensions";
import { createLinkHighlightExtension, MENTION_TARGET_ATTR } from "@/lib/tiptap-link-highlight";
import { splitParagraphsOnBreaks } from "@/lib/tiptap-paste";
import type { Pattern } from "@/lib/linker/aho-corasick";
import { saveEntityContentAction } from "@/actions/entity-content";
import { uploadImageAction } from "@/actions/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMentionSuggestion } from "./mention-suggestion";
import { ResizableImageView } from "./resizable-image-view";

const AUTOSAVE_DEBOUNCE_MS = 1500;
// Marge au-dessus du polling pg-boss par defaut (~2 s) + traitement du job
// (KAN-19) : estimation temporelle, pas une preuve que le worker a fini -
// aucun signal serveur de completion n'existe (hors perimetre). La note
// disparait par convention, coherent avec le leger decalage deja
// documente/accepte ailleurs (page.tsx de la fiche).
const AUTO_PENDING_NOTE_MS = 4_000;

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

// Boutons ghost (KAN-36 P4) : plus de pill bordee claire, sur INK la bordure
// alourdissait chaque bouton - inactif = transparent + hover discret, actif =
// fond MINT plein + texte primary-foreground (meme paire que Button variant
// "default", contraste 5.62:1 deja documente dans globals.css) plutot qu'un
// simple text-primary/tinte : verifie qu'un text-primary sur un fond MINT a
// 15% d'opacite tombe a ~3.6:1 sur INK, sous le seuil RGAA 4,5:1. Aucune
// modif des commandes/handlers, seul le style change.
const toolbarButtonBase =
  "rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
const toolbarButtonActive = "bg-primary text-primary-foreground";
const toolbarButtonInactive = "text-muted-foreground hover:bg-accent hover:text-foreground";

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

// Dialog shadcn (KAN-39 volet 4) : remplace le popover maison (div absolute
// sans Escape/clic exterieur/focus trap/role dialog - rien ne le fermait sauf
// re-cliquer le bouton). Radix fournit tout ca gratuitement, meme patron deja
// en place pour CreateEntityDialog/EntitySettingsDialog. `open` reste un
// useState local, pilote par Dialog en mode controle (open/onOpenChange).
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ToolbarButton label="Lien" active={active} onClick={() => setOpen(true)} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lien</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="link-url">URL du lien</Label>
          <Input
            id="link-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
          />
        </div>
        <DialogFooter>
          <Button type="button" onClick={apply}>
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ToolbarButton label="Image" onClick={() => setOpen(true)} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insérer une image</DialogTitle>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="image-file">Importer une image</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choisir un fichier
            </Button>
          </div>
          {/* Input natif cache (KAN-39, retour Aymeric) - sr-only le garde
              accessible/focusable au clavier (associe au bouton ci-dessus via
              la ref, pas via htmlFor - deux libelles pour un meme champ
              preterait a confusion pour les lecteurs d'ecran). Le nom du
              fichier choisi s'affiche separement en dessous, pas dans le
              rendu natif du champ (bouton + texte accoles, impossible a
              disposer independamment). */}
          <input
            ref={fileInputRef}
            id="image-file"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <p className="text-xs text-muted-foreground">
            {file ? file.name : "Aucun fichier choisi"}
          </p>
        </div>
        {/* URL manuelle (KAN-39, retour Aymeric) : rendue visuellement
            secondaire - libelle et champ plus petits - par rapport a
            l'import de fichier, l'option principale. */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="image-url" className="text-xs font-normal text-muted-foreground">
            …ou URL de l&apos;image
          </Label>
          <Input
            id="image-url"
            type="url"
            value={url}
            disabled={file !== null}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            className="h-7 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="image-alt">Légende</Label>
          <Input
            id="image-alt"
            type="text"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </div>
        <DialogFooter>
          {/* Ligne d'aide (KAN-39 volet 4) : le bouton reste desactive tant
              que l'alt est vide - sans explication, ce n'est pas evident
              pourquoi "Inserer" ne repond pas. aria-describedby relie
              explicitement le bouton a cette explication (pas seulement une
              proximite visuelle). */}
          <p id="image-insert-hint" className="text-xs text-muted-foreground sm:mr-auto">
            « Insérer » s&apos;active une fois la légende renseignée.
          </p>
          <Button
            type="button"
            onClick={() => void apply()}
            disabled={!canInsert}
            aria-busy={uploading}
            aria-describedby="image-insert-hint"
          >
            {uploading ? "Envoi…" : "Insérer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    // sticky top-0 (KAN-39 volet 3) : reste visible pendant le defilement
    // d'une longue entree. Fond discret (bg-card/85 + flou, pas plein - retour
    // Aymeric : sans fond les boutons se distinguaient mal du texte qui
    // defile dessous, mais un fond plein etait trop lourd) - w-fit + arrondi
    // pour une pastille flottante plutot qu'une barre pleine largeur ; z-10,
    // sous les Dialog/AlertDialog (z-50, dialog.tsx/alert-dialog.tsx), meme
    // repere que le bouton "Explorer" du dashboard. Necessite
    // overflow-visible sur la Card ancetre (world-shell.tsx) - un
    // overflow-hidden entre la toolbar et son vrai conteneur defilant
    // (<main>) neutraliserait sinon le sticky.
    <div
      role="toolbar"
      aria-label="Mise en forme"
      className="sticky top-0 z-10 flex w-fit flex-wrap gap-1.5 rounded-lg bg-card/85 px-2 py-1.5 backdrop-blur-sm"
    >
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
  // autoPending (KAN-19) : note transitoire "liens en cours" apres un save
  // reussi - purement indicative (voir AUTO_PENDING_NOTE_MS), pas un etat de
  // chargement reel du job worker.
  const [autoPending, setAutoPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          if (result.ok) {
            // Re-execute la page (Server Component) pour rafraichir "Renvois"
            // (LinkedEntities, relation-service.ts) sans navigation ni perte
            // d'etat de l'edition en cours : useEditor ci-dessous n'a pas de
            // tableau de dependances (figee au montage, meme regle que le
            // dictionnaire de surlignage), donc les nouvelles props ignorees
            // par ce hook ne recreent jamais l'editeur. Couvre les mentions
            // MANUAL (deja ecrites en base de facon synchrone par
            // reconcileManualMentions) immediatement ; une Relation AUTO
            // ecrite par le worker apres ce point n'apparaitra qu'au refresh
            // suivant (prochaine frappe) - decalage deja documente/accepte
            // dans page.tsx, pas aggrave par cet appel.
            router.refresh();
            setAutoPending(true);
            if (autoPendingTimeoutRef.current) {
              clearTimeout(autoPendingTimeoutRef.current);
            }
            autoPendingTimeoutRef.current = setTimeout(() => {
              setAutoPending(false);
            }, AUTO_PENDING_NOTE_MS);
          }
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [worldId, entityId, router],
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
      // imageNodeView (KAN-39 volet 5) : ReactNodeViewRenderer(...) appele
      // ICI, a chaque montage - fraiche a chaque fois, meme invariant
      // StrictMode que le reste des extensions de ce tableau.
      ...createEditorExtensions(createMentionSuggestion(mentionableEntities), {
        imageNodeView: ReactNodeViewRenderer(ResizableImageView),
      }),
      createLinkHighlightExtension({ dictionary, selfEntityId: entityId, ignoredTargetIds }),
    ],
    content: initialContent,
    immediatelyRender: false,
    // transformPastedHTML (KAN-39 volet 2) : normalise le HTML colle AVANT le
    // parsing schema-aware de ProseMirror (donc avant meme SafeLink) - un
    // <p> avec des <br> (retour "souple" produit par Obsidian/Notion/Word)
    // devient plusieurs <p> distincts, sinon un "Sous-titre" pose sur sa
    // propre ligne dans l'outil source se retrouve fondu dans le paragraphe
    // suivant des le collage.
    editorProps: {
      transformPastedHTML: splitParagraphsOnBreaks,
    },
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
      if (autoPendingTimeoutRef.current) {
        clearTimeout(autoPendingTimeoutRef.current);
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
        // Placeholder (KAN-36 P4) : l'extension pose une decoration
        // .is-editor-empty + data-placeholder sur le premier noeud vide -
        // recette CSS standard Tiptap (float-left/h-0/pointer-events-none)
        // traduite en variantes Tailwind arbitraires, meme patron que le reste
        // de cette classe (skill headless-editor-tailwind-preflight).
        className="min-h-[200px] rounded-md border border-input px-3 py-2 text-sm text-foreground focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring [&_.ProseMirror]:outline-none [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-medium [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-heading [&_h3]:text-lg [&_h3]:font-medium [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_.entity-mention]:cursor-pointer [&_.entity-mention]:underline [&_.entity-mention]:decoration-dotted [&_.entity-mention]:decoration-muted-foreground [&_.entity-mention]:underline-offset-2 [&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
      />
      <p aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {status === "saving" ? "Enregistrement…" : null}
          {status === "saved" ? "Enregistré." : null}
          {status === "error" ? (errorMessage ?? "Erreur d'enregistrement.") : null}
        </span>
        {/* Note transitoire (KAN-19) : purement indicative, voir
            AUTO_PENDING_NOTE_MS - n'atteste pas que le worker a fini. */}
        {autoPending ? (
          <span className="flex items-center gap-1">
            <Loader2 aria-hidden="true" className="size-3 animate-spin" />
            Mise à jour des liens détectés…
          </span>
        ) : null}
      </p>
    </div>
  );
}
