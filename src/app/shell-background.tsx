// Fond plein ecran partage entre (auth)/layout.tsx et (app)/layout.tsx
// (KAN-36 P1 : "generaliser le fond du login au layout authentifie entier").
// Purement decoratif (aria-hidden) : aucune information n'y est portee,
// l'artwork futur (--bg-image, par monde) restera en background-image,
// jamais en <img> porteur de sens. Le voile (--shell-scrim/-blur) et le
// cadrage (--shell-bg-position) sont parametrables par variable CSS
// (ADR-0026) : valeurs par defaut dans :root (globals.css), surchargeables
// par le layout qui l'englobe (ex. .auth-artwork).
export function ShellBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-position-(--shell-bg-position) [background-image:var(--bg-image,var(--shell-bg-fallback))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-(--shell-scrim) backdrop-blur-(--shell-scrim-blur)"
      />
    </>
  );
}
