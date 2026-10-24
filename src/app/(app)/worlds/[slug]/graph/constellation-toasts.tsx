"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Notifications locales a la Constellation (KAN-87) : aucun systeme de toasts
// global dans l'app, une region polie suffit (echec de sauvegarde,
// « Disposition reorganisee » + Annuler). Region TOUJOURS presente dans le
// DOM (role=status) : un lecteur d'ecran n'annonce que les changements d'une
// region deja montee.

export type ConstellationToast = {
  id: number;
  message: string;
  action?: { label: string; onAction: () => void };
};

const DEFAULT_DURATION_MS = 8000;

export function useConstellationToasts() {
  const [toasts, setToasts] = useState<ConstellationToast[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ConstellationToast, "id">, durationMs = DEFAULT_DURATION_MS) => {
      nextIdRef.current += 1;
      const id = nextIdRef.current;
      setToasts((current) => [...current, { ...toast, id }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return { toasts, show, dismiss };
}

export function ConstellationToasts({
  toasts,
  onDismiss,
}: {
  toasts: ConstellationToast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onDismiss(toast.id);
            }
          }}
          className="pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.action ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                toast.action?.onAction();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Fermer la notification"
            onClick={() => onDismiss(toast.id)}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
