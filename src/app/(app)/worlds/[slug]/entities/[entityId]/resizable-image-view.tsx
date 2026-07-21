"use client";

import { useState } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

const MIN_WIDTH_PERCENT = 10;
const MAX_WIDTH_PERCENT = 100;
const KEYBOARD_STEP_PERCENT = 5;

function clampWidth(value: number): number {
  return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, Math.round(value)));
}

// NodeView React (KAN-39 volet 5) : redimensionnement par poignee de drag,
// largeur persistee en POURCENTAGE de la largeur du contenu (attrs.width,
// ResizableImage dans tiptap-extensions.ts) - jamais en pixels, la mise en
// page reste fluide quelle que soit la largeur de l'ecran. Cree fraichement a
// chaque montage d'Editor (ReactNodeViewRenderer appele depuis
// entity-editor.tsx, jamais au niveau module de tiptap-extensions.ts) - meme
// invariant StrictMode que SafeLink.
//
// `ref` vient de Tiptap (ReactNodeViewProps), pas un useRef maison - transmis
// tel quel a NodeViewWrapper qui le forwarde a l'element DOM reel (verifie
// dans node_modules/@tiptap/react/dist/index.js).
export function ResizableImageView({ node, updateAttributes, selected, ref }: ReactNodeViewProps) {
  const width = typeof node.attrs.width === "number" ? node.attrs.width : 100;
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const displayWidth = liveWidth ?? width;

  function commit(nextWidth: number) {
    updateAttributes({ width: clampWidth(nextWidth) });
  }

  // Pointer Events (pas mouse/touch separes) : un seul chemin pour souris,
  // stylet et tactile. Largeur live en state local pendant le drag, commit
  // dans la transaction ProseMirror (updateAttributes) seulement au
  // relachement - une seule transaction par geste, pas une par pixel.
  function handlePointerDown(event: React.PointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    // stopPropagation : Image a `draggable: true` herite (deplacement du
    // noeud dans le document) - sans ca, le drag de la poignee declencherait
    // aussi le drag-deplacement natif du noeud.
    event.stopPropagation();

    // Largeur de reference = le conteneur de contenu stable (le vrai
    // denominateur du pourcentage), pas l'image elle-meme (ref.current) qui
    // change de taille pendant le drag.
    const editorRoot = ref.current?.closest(".ProseMirror");
    const containerWidth = editorRoot instanceof HTMLElement ? editorRoot.clientWidth : 0;
    if (containerWidth === 0) {
      return;
    }

    const startX = event.clientX;
    const startWidth = width;

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaPercent = ((moveEvent.clientX - startX) / containerWidth) * 100;
      setLiveWidth(clampWidth(startWidth + deltaPercent));
    }
    function handlePointerUp(upEvent: PointerEvent) {
      const deltaPercent = ((upEvent.clientX - startX) / containerWidth) * 100;
      commit(startWidth + deltaPercent);
      setLiveWidth(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  // Equivalent clavier (RGAA, obligatoire - le drag ne doit jamais etre le
  // seul chemin) : patron ARIA slider standard (role="slider" +
  // aria-valuenow/min/max), fleches gauche/droite = pas de 5%, chaque pas
  // commit immediatement (pas de distinction drag/clavier cote persistance).
  function handleKeyDown(event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      commit(width - KEYBOARD_STEP_PERCENT);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      commit(width + KEYBOARD_STEP_PERCENT);
    }
  }

  return (
    <NodeViewWrapper
      ref={ref}
      as="div"
      className="relative inline-block"
      style={{ width: `${displayWidth}%` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- contenu
          d'entree arbitraire (URL externe ou /api/media/<id>, KAN-16),
          dimensions inconnues a l'avance : next/image suppose des
          dimensions/domaines connus au build, inadapte a une image inseree
          librement dans l'editeur. Meme rendu qu'avant ce volet (Image de
          @tiptap/extension-image produisait deja un <img> brut, invisible a
          cette regle car non-JSX). */}
      <img
        src={typeof node.attrs.src === "string" ? node.attrs.src : ""}
        alt={typeof node.attrs.alt === "string" ? node.attrs.alt : ""}
        loading="lazy"
        className={
          selected
            ? "block h-auto w-full rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "block h-auto w-full rounded-md"
        }
      />
      {selected ? (
        <span
          role="slider"
          aria-label="Largeur de l'image"
          aria-valuenow={Math.round(displayWidth)}
          aria-valuemin={MIN_WIDTH_PERCENT}
          aria-valuemax={MAX_WIDTH_PERCENT}
          aria-orientation="horizontal"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          className="absolute top-1/2 right-0 h-10 w-3 translate-x-1/2 -translate-y-1/2 touch-none cursor-ew-resize rounded-full bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      ) : null}
    </NodeViewWrapper>
  );
}
