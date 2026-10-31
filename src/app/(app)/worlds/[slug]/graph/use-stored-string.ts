"use client";

import { useCallback, useSyncExternalStore } from "react";

// Valeur memorisee dans le navigateur (KAN-87 : panneau replie, filtres par
// monde). Toute lecture/ecriture est protegee (stockage bloque, navigation
// privee, quota) : en cas d'echec, la valeur vit en memoire le temps de la
// session, sans erreur. useSyncExternalStore (meme patron que world-shell)
// : pas de setState dans un effet, rendu serveur = null (pas de mismatch).

const CHANGE_EVENT = "storytide:stored-string-change";
const memory = new Map<string, string>();

function readStored(key: string): string | null {
  const remembered = memory.get(key);
  if (remembered !== undefined) {
    return remembered;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot() {
  return null;
}

export function useStoredString(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => readStored(key), getServerSnapshot);
  const write = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Stockage indisponible : la valeur reste en memoire (voir en-tete).
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );
  return [value, write];
}
