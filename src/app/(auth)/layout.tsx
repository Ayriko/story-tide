export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Fond decoratif plein ecran : --bg-image (artwork de monde, cable
          pour plus tard) avec repli degrade+lueur defini dans globals.css.
          Purement decoratif (aria-hidden) : aucune information n'y est
          portee, l'artwork futur restera en background-image, jamais en
          <img> porteur de sens. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center [background-image:var(--bg-image,var(--auth-bg-fallback))]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/45 backdrop-blur-md" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 md:items-end md:px-12 md:py-16 lg:px-20">
        <main className="w-full max-w-md md:w-[32rem]">{children}</main>
      </div>
    </div>
  );
}
