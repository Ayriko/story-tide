"use client";

import { useSyncExternalStore } from "react";

const REFRESH_MS = 60_000;

function subscribe(callback: () => void) {
  const id = setInterval(callback, REFRESH_MS);
  return () => clearInterval(id);
}

// Bucket a la minute (pas l'horodatage exact) : stable entre deux lectures
// rapprochees de getSnapshot (React verifie que la valeur ne "dechire" pas
// pendant un meme rendu), ne change reellement que lorsque `subscribe`
// notifie (chaque minute). `getServerSnapshot` renvoie null : jamais d'heure
// au premier rendu serveur (evite le hydration mismatch - l'heure du serveur
// differe forcement de celle du navigateur), sans setState synchrone dans un
// effet (regle react-hooks/set-state-in-effect) - useSyncExternalStore est
// le mecanisme React dedie a une valeur pilotee par un systeme externe (ici :
// l'horloge de l'OS).
function getSnapshot() {
  return Math.floor(Date.now() / REFRESH_MS);
}
function getServerSnapshot() {
  return null;
}

export function LocalClock() {
  const minuteBucket = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (minuteBucket === null) {
    return null;
  }

  const now = new Date();
  const formatted = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
    now,
  );

  return (
    <time
      dateTime={now.toISOString()}
      aria-label={`Il est ${formatted}`}
      className="text-sm text-muted-foreground"
    >
      {formatted}
    </time>
  );
}
