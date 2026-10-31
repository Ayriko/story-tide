// Banc de mesure de la Constellation (KAN-85, docs/performance-constellation.md).
// Outil de DEVELOPPEMENT : pilote un Chromium Playwright VISIBLE (le rendu
// reel, GPU compris), avec les options qui desactivent le bridage des
// fenetres en arriere-plan - sans elles, une fenetre pilotee ou masquee
// tombe a 24 voire 1 image/s et la mesure ne vaut rien.
//
// Prerequis : serveur lance avec le crochet de test (positions des etoiles) :
//   $env:NEXT_PUBLIC_E2E_HOOKS = "1"; npm run dev
// et le monde de test seme : npm run seed:perf -- <email>
//
// Usage :
//   npm run perf:constellation -- <email> <mot de passe> [--reseed] [--runs=3]
//     [--base=http://localhost:3000] [--slug=ciel-de-test-300] [--cpu=4]
//
// --cpu=N ralentit le processeur d'un facteur N (protocole DevTools,
// Emulation.setCPUThrottlingRate) : un poste de developpement rapide sur un
// ecran 60 Hz masque les problemes ; x4 represente un portable modeste.
//
// --reseed recree le monde AVANT la premiere visite : le premier affichage
// passe alors par fcose (aucune disposition enregistree). Sans --reseed, la
// disposition memorisee est reutilisee.
import { execSync } from "node:child_process";
import { chromium, type Page } from "@playwright/test";

type FrameStats = {
  fps: number;
  p95Ms: number;
  worstMs: number;
  over17: number;
  frames: number;
  visibility: DocumentVisibilityState;
};
type Scenario = "idle" | "zoom" | "pan" | "drag" | "hover";

const SCENARIOS: Scenario[] = ["idle", "zoom", "pan", "drag", "hover"];

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

// Execute DANS la page : enregistre chaque image pendant `durationMs` en
// pilotant des evenements synthetiques sur le canvas Cytoscape.
async function runInPage(scenario: Scenario): Promise<FrameStats> {
  const hook = window.__storyTideConstellation;
  if (!hook) {
    throw new Error("Crochet e2e absent : lancer le serveur avec NEXT_PUBLIC_E2E_HOOKS=1");
  }
  const nodes = hook.nodes();
  const canvasAt = (x: number, y: number): Element =>
    document.elementFromPoint(x, y) ?? document.body;
  const mouse = (type: string, x: number, y: number, target?: Element) =>
    (target ?? canvasAt(x, y)).dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === "mouseup" ? 0 : 1,
      }),
    );
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
  const center = { x: median(nodes.map((n) => n.clientX)), y: median(nodes.map((n) => n.clientY)) };
  const nearest = [...nodes].sort(
    (a, b) =>
      Math.hypot(a.clientX - center.x, a.clientY - center.y) -
      Math.hypot(b.clientX - center.x, b.clientY - center.y),
  )[0];
  if (!nearest) {
    throw new Error("Aucune etoile");
  }

  let step: (progress: number, frame: number) => void = () => {};
  let durationMs = 3000;
  if (scenario === "idle") {
    durationMs = 2000;
  } else if (scenario === "zoom") {
    const target = canvasAt(center.x, center.y);
    step = (p, frame) => {
      if (p < 1 && frame % 2 === 0) {
        target.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: center.x,
            clientY: center.y,
            deltaY: p < 0.5 ? -60 : 60,
          }),
        );
      }
    };
  } else if (scenario === "pan") {
    // Fond vide en haut a gauche de la zone du graphe (sous le titre).
    const x0 = 300;
    const y0 = 320;
    mouse("mousedown", x0, y0);
    step = (p) => {
      const x = x0 + Math.sin(p * Math.PI * 2) * 250;
      const y = y0 + (Math.cos(p * Math.PI * 2) - 1) * 120;
      mouse(p < 1 ? "mousemove" : "mouseup", x, y, document.body);
    };
  } else if (scenario === "drag") {
    mouse("mousedown", nearest.clientX, nearest.clientY);
    step = (p) => {
      const x = nearest.clientX + Math.sin(p * Math.PI * 2) * 200;
      const y = nearest.clientY + Math.sin(p * Math.PI * 4) * 80;
      mouse(p < 1 ? "mousemove" : "mouseup", x, y, document.body);
    };
  } else {
    // Une nouvelle etoile survolee toutes les 6 images (~10 survols/s).
    step = (p, frame) => {
      const node = nodes[Math.floor(frame / 6) % nodes.length];
      if (p < 1 && frame % 6 === 0 && node) {
        mouse("mousemove", node.clientX, node.clientY, canvasAt(node.clientX, node.clientY));
      }
    };
  }

  return new Promise((resolve) => {
    const frames: number[] = [];
    const start = performance.now();
    let last = start;
    let count = 0;
    function tick(now: number) {
      frames.push(now - last);
      last = now;
      count += 1;
      const progress = Math.min(1, (now - start) / durationMs);
      step(progress, count);
      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }
      const sorted = frames.slice(1).sort((a, b) => a - b);
      const total = sorted.reduce((sum, f) => sum + f, 0);
      resolve({
        fps: Math.round((10000 * sorted.length) / total) / 10,
        p95Ms: Math.round(10 * (sorted[Math.floor(sorted.length * 0.95)] ?? 0)) / 10,
        worstMs: Math.round(10 * (sorted[sorted.length - 1] ?? 0)) / 10,
        over17: sorted.filter((f) => f > 17.5).length,
        frames: sorted.length,
        visibility: document.visibilityState,
      });
    }
    requestAnimationFrame(tick);
  });
}

// Premier affichage : taches longues (fcose), decalages (CLS), images
// pendant les 2 s qui suivent l'apparition des etoiles.
// Amorce : enregistre chaque image des l'apparition des etoiles, pendant 2 s
// (arrivee animee comprise). Posee une fois sur le contexte.
function bootRecorder() {
  {
    const frames: number[] = [];
    let last = performance.now();
    const w = window as unknown as { __perfBoot: { frames: number[]; visibleAt: number | null } };
    w.__perfBoot = { frames, visibleAt: null };
    function tick(now: number) {
      if (w.__perfBoot.visibleAt === null && window.__storyTideConstellation) {
        w.__perfBoot.visibleAt = now;
      }
      if (w.__perfBoot.visibleAt !== null) {
        frames.push(now - last);
      }
      last = now;
      if (w.__perfBoot.visibleAt === null || now - w.__perfBoot.visibleAt < 2000) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }
}

// Affichage d'une page de monde : taches longues (fcose au premier passage),
// decalages (CLS), images pendant les 2 s qui suivent l'apparition des
// etoiles - c'est la fenetre de l'arrivee animee (~1 s).
async function firstDisplay(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => (window.__storyTideConstellation?.nodes().length ?? 0) > 0);
  await page.waitForTimeout(2500);
  return page.evaluate(async () => {
    const w = window as unknown as { __perfBoot: { frames: number[]; visibleAt: number | null } };
    const entries = (type: string) =>
      new Promise<PerformanceEntry[]>((resolve) => {
        new PerformanceObserver((list, observer) => {
          observer.disconnect();
          resolve(list.getEntries());
        }).observe({ type, buffered: true });
        setTimeout(() => resolve([]), 300);
      });
    const longTasks = (await entries("longtask")).map((e) => Math.round(e.duration));
    const cls = (await entries("layout-shift"))
      .map((e) => e as PerformanceEntry & { value: number; hadRecentInput: boolean })
      .filter((e) => !e.hadRecentInput)
      .reduce((sum, e) => sum + e.value, 0);
    const frames = w.__perfBoot.frames.slice(1).sort((a, b) => a - b);
    const total = frames.reduce((sum, f) => sum + f, 0);
    return {
      visibleAtMs: Math.round(w.__perfBoot.visibleAt ?? -1),
      longTasksMs: longTasks,
      cls: Math.round(cls * 10000) / 10000,
      after: {
        fps: total > 0 ? Math.round((10000 * frames.length) / total) / 10 : 0,
        frames: frames.length,
        worstMs: Math.round(frames[frames.length - 1] ?? 0),
        over17: frames.filter((f) => f > 17.5).length,
      },
    };
  });
}

async function recordFrames(durationMs: number): Promise<FrameStats> {
  return new Promise((resolve) => {
    const frames: number[] = [];
    const start = performance.now();
    let last = start;
    function tick(now: number) {
      frames.push(now - last);
      last = now;
      if (now - start < durationMs) {
        requestAnimationFrame(tick);
        return;
      }
      const sorted = frames.slice(1).sort((a, b) => a - b);
      const total = sorted.reduce((sum, f) => sum + f, 0);
      resolve({
        fps: Math.round((10000 * sorted.length) / total) / 10,
        p95Ms: Math.round(10 * (sorted[Math.floor(sorted.length * 0.95)] ?? 0)) / 10,
        worstMs: Math.round(10 * (sorted[sorted.length - 1] ?? 0)) / 10,
        over17: sorted.filter((f) => f > 17.5).length,
        frames: sorted.length,
        visibility: document.visibilityState,
      });
    }
    requestAnimationFrame(tick);
  });
}

async function relationCreation(page: Page, attempt: number): Promise<FrameStats | null> {
  const stars = await page.evaluate(() => window.__storyTideConstellation?.nodes() ?? []);
  const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const central = [...stars].sort(
    (a, b) =>
      Math.hypot(a.clientX - cx, a.clientY - cy) - Math.hypot(b.clientX - cx, b.clientY - cy),
  );
  // Deux etoiles proches du centre, differentes a chaque passage.
  const from = central[attempt * 2];
  const to = central[attempt * 2 + 7];
  if (!from || !to) {
    return null;
  }
  await page.keyboard.down("Shift");
  await page.mouse.move(from.clientX, from.clientY);
  await page.mouse.down();
  await page.mouse.move(to.clientX, to.clientY, { steps: 15 });
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const dialog = page.getByRole("dialog", { name: "Nouvelle relation", exact: true });
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  await dialog.getByLabel("Type de relation", { exact: true }).selectOption({ label: "Rival" });
  const recording = page.evaluate(recordFrames, 1200);
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  const stats = await recording;
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  return stats;
}

async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!email || !password) {
    throw new Error(
      "Usage : npm run perf:constellation -- <email> <mot de passe> [--reseed] [--runs=3]",
    );
  }
  const base = arg("base") ?? "http://localhost:3000";
  const slug = arg("slug") ?? "ciel-de-test-300";
  const runs = Number(arg("runs") ?? "3");
  const cpu = Number(arg("cpu") ?? "1");

  if (process.argv.includes("--reseed")) {
    // E-mail valide avant de l'inserer dans la commande (aucun caractere de
    // shell possible).
    if (!/^[\w.+-]+@[\w.-]+$/.test(email)) {
      throw new Error(`E-mail invalide : ${email}`);
    }
    execSync(`npm run seed:perf -- ${email}`, { stdio: "inherit" });
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      // Windows : sinon une fenetre recouverte passe pour masquee (1 image/s).
      "--disable-features=CalculateNativeWinOcclusion",
      "--window-size=1920,1080",
    ],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    // tsx (esbuild keepNames) entoure les fonctions nommees d'un appel a
    // __name : les fonctions envoyees a page.evaluate en ont besoin cote page.
    // Script en TEXTE : une fonction serait elle-meme instrumentee.
    await context.addInitScript({ content: "globalThis.__name = (fn) => fn;" });
    const page = await context.newPage();
    if (cpu > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    }
    await page.goto(`${base}/login`);
    const status = await page.evaluate(
      async ([e, p]) =>
        (
          await fetch("/api/auth/sign-in/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: e, password: p }),
          })
        ).status,
      [email, password] as const,
    );
    if (status !== 200) {
      throw new Error(`Connexion refusee (${status})`);
    }

    await context.addInitScript(bootRecorder);
    await page.bringToFront();
    const first = await firstDisplay(page, `${base}/worlds/${slug}`);
    console.log(JSON.stringify({ cpu, firstDisplay: first }));
    // Second affichage : disposition memorisee, l'arrivee animee seule.
    const arrival = await firstDisplay(page, `${base}/worlds/${slug}`);
    console.log(JSON.stringify({ cpu, arrival }));

    const results: Record<string, FrameStats[]> = {};
    for (let run = 0; run < runs; run += 1) {
      await page.reload();
      await page.waitForFunction(() => (window.__storyTideConstellation?.nodes().length ?? 0) > 0);
      await page.waitForTimeout(1500);
      for (const scenario of SCENARIOS) {
        await page.bringToFront();
        const stats = await page.evaluate(runInPage, scenario);
        (results[scenario] ??= []).push(stats);
        await page.waitForTimeout(400);
      }
    }
    // Creation d'une relation (trace + eclat), une par passage.
    const creations: FrameStats[] = [];
    for (let attempt = 0; attempt < runs; attempt += 1) {
      await page.bringToFront();
      const stats = await relationCreation(page, attempt);
      if (stats) {
        creations.push(stats);
      }
      await page.waitForTimeout(600);
    }
    results.relation = creations;
    // Mediane des runs par scenario (sur les images/s).
    for (const scenario of [...SCENARIOS, "relation"]) {
      const sorted = [...(results[scenario] ?? [])].sort((a, b) => a.fps - b.fps);
      console.log(
        JSON.stringify({ scenario, median: sorted[Math.floor(sorted.length / 2)], runs: sorted }),
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("[perf] echec", error);
  process.exit(1);
});
