// Fond plein ecran partage entre (auth)/layout.tsx et (app)/layout.tsx
// (KAN-36 P1 : "generaliser le fond du login au layout authentifie entier").
// Purement decoratif (aria-hidden) : aucune information n'y est portee,
// l'artwork futur (--bg-image, par monde) restera en background-image,
// jamais en <img> porteur de sens.
export function ShellBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center [background-image:var(--bg-image,var(--shell-bg-fallback))]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/45 backdrop-blur-md" />
    </>
  );
}
