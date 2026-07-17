// Convention DOM partagee entre le surlignage live (decorations,
// tiptap-link-highlight.ts) et les mentions manuelles persistees
// (node "mention", tiptap-extensions.ts) : meme classe visuelle, meme
// attribut lu par le gestionnaire Ctrl/Cmd+clic (entity-editor.tsx) -
// un seul chemin de rendu/navigation pour les deux mecanismes.
export const MENTION_CLASS_NAME = "entity-mention";
export const MENTION_TARGET_ATTR = "data-target-id";
