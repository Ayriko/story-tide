// Garde des scripts de developpement qui ECRIVENT en masse (seed de
// performance, KAN-85) : refus net hors d'une base locale de dev. Meme regle
// d'hote que e2e/global-setup.ts (localhost / 127.0.0.1), sans l'exigence du
// suffixe _e2e (la base de dev s'appelle story_tide). TS pur : testee sans
// base ni process.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export class DevScriptRefusedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DevScriptRefusedError";
  }
}

export function assertLocalDevDatabase({
  nodeEnv,
  databaseUrl,
}: {
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
}): void {
  if (nodeEnv === "production") {
    throw new DevScriptRefusedError(
      "Refus : script de developpement lance avec NODE_ENV=production.",
    );
  }
  if (!databaseUrl) {
    throw new DevScriptRefusedError("Refus : DATABASE_URL absente.");
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch (error) {
    throw new DevScriptRefusedError("Refus : DATABASE_URL invalide.", { cause: error });
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new DevScriptRefusedError(`Refus : base non locale (${url.hostname}).`);
  }
}
