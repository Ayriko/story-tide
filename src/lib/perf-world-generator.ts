import type { JSONContent } from "@tiptap/core";
import {
  ENTITY_TYPE_GROUPS,
  ENTITY_TYPE_REFERENCE,
  ENTITY_TYPES,
  type EntityTypeGroup,
} from "./entity-schemas";
import { mulberry32 } from "./prng";
import { RELATION_TYPES, type NativeRelationType } from "./relation-types";

// Monde de test de performance de la Constellation (KAN-85) : 300 entrees,
// ~600 liens du texte, ~150 relations declarees, avec une distribution
// realiste (quelques astres tres lies, la plupart a 1-4 liens, une dizaine
// d'isolees, quelques grappes). Generation DETERMINISTE : meme graine, memes
// donnees, d'un poste a l'autre et d'une session de mesure a l'autre. TS pur,
// sans base : les index d'entrees sont traduits en id par le service.

export const PERF_WORLD = {
  name: "Ciel de test · 300",
  slug: "ciel-de-test-300",
  seed: 0x5ca1_0085,
} as const;

export const PERF_COUNTS = {
  entities: 300,
  textLinks: 600,
  declared: 150,
  // Relations declarees posees sur une paire deja liee par le texte (le cas
  // courant : on declare ce que le texte suggere) ; le reste sur des paires
  // nouvelles.
  declaredOnTextPairs: 100,
  isolated: 10,
  hubs: 8,
  clusters: 5,
} as const;

const HUB_MIN_LINKS = 10;
const HUB_MAX_LINKS = 30;
// Plafond des entrees ordinaires pendant le remplissage : garde la majorite
// entre 1 et 4 liens. Releve d'un cran si le remplissage s'essouffle.
const ORDINARY_CAP = 4;
const MANUAL_SHARE = 0.1;
const INTRA_CLUSTER_SHARE = 0.85;

export type PerfEntity = {
  ref: string;
  name: string;
  type: (typeof ENTITY_TYPES)[number];
  group: EntityTypeGroup;
};
export type PerfTextLink = { source: number; target: number; origin: "AUTO" | "MANUAL" };
export type PerfDeclared = { source: number; target: number; type: NativeRelationType };
export type PerfWorldPlan = {
  entities: PerfEntity[];
  textLinks: PerfTextLink[];
  declared: PerfDeclared[];
};

// Acces indexe borne (noUncheckedIndexedAccess) : un index hors bornes est un
// bogue du generateur, jamais une donnee absente acceptable.
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${index} hors bornes (${items.length})`);
  }
  return item;
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return at(items, Math.floor(rng() * items.length));
}

function shuffled<T>(rng: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = at(copy, i);
    copy[i] = at(copy, j);
    copy[j] = tmp;
  }
  return copy;
}

const SYLLABLES = [
  "al",
  "ber",
  "cor",
  "dra",
  "el",
  "fen",
  "gal",
  "hor",
  "is",
  "jor",
  "ka",
  "lu",
  "mor",
  "nev",
  "or",
  "pel",
  "quin",
  "ra",
  "sel",
  "tor",
  "ul",
  "vi",
  "wen",
  "xa",
  "yr",
  "zan",
] as const;

// Noms d'un seul mot (2 ou 3 syllabes), uniques : un nom ne peut donc
// apparaitre dans le texte d'une autre entree que s'il y est cite - un
// re-scan du worker retrouverait exactement les liens AUTO ecrits.
function generateNames(rng: () => number, count: number): string[] {
  const names = new Set<string>();
  while (names.size < count) {
    const parts = [pick(rng, SYLLABLES), pick(rng, SYLLABLES)];
    if (rng() < 0.35) {
      parts.push(pick(rng, SYLLABLES));
    }
    const raw = parts.join("");
    names.add(raw.charAt(0).toUpperCase() + raw.slice(1));
  }
  return [...names];
}

function typesByGroup(): Map<EntityTypeGroup, (typeof ENTITY_TYPES)[number][]> {
  const map = new Map<EntityTypeGroup, (typeof ENTITY_TYPES)[number][]>();
  for (const type of ENTITY_TYPES) {
    const { group } = ENTITY_TYPE_REFERENCE[type];
    map.set(group, [...(map.get(group) ?? []), type]);
  }
  return map;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

export function generatePerfWorld(seed: number = PERF_WORLD.seed): PerfWorldPlan {
  const rng = mulberry32(seed);
  const total = PERF_COUNTS.entities;

  // Entrees : groupes en tourniquet (les 8 representes a parts egales), type
  // tire dans le groupe.
  const groupTypes = typesByGroup();
  const names = generateNames(rng, total);
  const entities: PerfEntity[] = names.map((name, index) => {
    const group = at(ENTITY_TYPE_GROUPS, index % ENTITY_TYPE_GROUPS.length);
    return {
      ref: `perf-${String(index + 1).padStart(3, "0")}`,
      name,
      type: pick(rng, groupTypes.get(group) ?? ["note"]),
      group,
    };
  });

  // Roles : isolees, astres, puis grappes pour les autres.
  const order = shuffled(
    rng,
    entities.map((_, index) => index),
  );
  const isolated = new Set(order.slice(0, PERF_COUNTS.isolated));
  const hubs = order.slice(PERF_COUNTS.isolated, PERF_COUNTS.isolated + PERF_COUNTS.hubs);
  const hubSet = new Set(hubs);
  const linked = order.slice(PERF_COUNTS.isolated);
  const clusterOf = new Map<number, number>();
  const clusters: number[][] = Array.from({ length: PERF_COUNTS.clusters }, () => []);
  linked.forEach((index, position) => {
    const cluster = position % PERF_COUNTS.clusters;
    clusterOf.set(index, cluster);
    at(clusters, cluster).push(index);
  });

  const degree = new Array<number>(total).fill(0);
  const pairs = new Map<string, [number, number]>();
  function addPair(a: number, b: number): boolean {
    if (a === b || isolated.has(a) || isolated.has(b) || pairs.has(pairKey(a, b))) {
      return false;
    }
    pairs.set(pairKey(a, b), [a, b]);
    degree[a] = at(degree, a) + 1;
    degree[b] = at(degree, b) + 1;
    return true;
  }
  function partnerOf(a: number): number {
    const cluster = at(clusters, clusterOf.get(a) ?? 0);
    return rng() < INTRA_CLUSTER_SHARE ? pick(rng, cluster) : pick(rng, linked);
  }

  // 1. Arbre par grappe : toute entree liee a au moins un voisin.
  for (const members of clusters) {
    for (let i = 1; i < members.length; i += 1) {
      addPair(at(members, i), at(members, Math.floor(rng() * i)));
    }
  }

  // 2. Astres : 10 a 30 voisins distincts.
  for (const hub of hubs) {
    const target = HUB_MIN_LINKS + Math.floor(rng() * (HUB_MAX_LINKS - HUB_MIN_LINKS + 1));
    let attempts = 0;
    while (at(degree, hub) < target && attempts < 1000) {
      attempts += 1;
      const other = partnerOf(hub);
      if (!hubSet.has(other)) {
        addPair(hub, other);
      }
    }
  }

  // 3. Remplissage jusqu'au nombre de liens du texte, entre entrees
  // ordinaires plafonnees.
  let cap = ORDINARY_CAP;
  let attempts = 0;
  while (pairs.size < PERF_COUNTS.textLinks) {
    attempts += 1;
    if (attempts % 5000 === 0) {
      cap += 1;
    }
    const a = pick(rng, linked);
    const b = partnerOf(a);
    if (hubSet.has(a) || hubSet.has(b) || at(degree, a) >= cap || at(degree, b) >= cap) {
      continue;
    }
    addPair(a, b);
  }

  const textPairs = [...pairs.values()];
  const textLinks: PerfTextLink[] = textPairs.map(([a, b]) => {
    const forward = rng() < 0.5;
    return {
      source: forward ? a : b,
      target: forward ? b : a,
      origin: rng() < MANUAL_SHARE ? "MANUAL" : "AUTO",
    };
  });

  // 4. Relations declarees : une par paire au plus, d'abord sur des paires
  // du texte, puis sur des paires nouvelles (hors astres, plafond releve).
  const declared: PerfDeclared[] = [];
  const declaredKeys = new Set<string>();
  function declare(a: number, b: number): void {
    declaredKeys.add(pairKey(a, b));
    declared.push({ source: a, target: b, type: pick(rng, RELATION_TYPES) });
  }
  for (const [a, b] of shuffled(rng, textPairs).slice(0, PERF_COUNTS.declaredOnTextPairs)) {
    declare(a, b);
  }
  attempts = 0;
  while (declared.length < PERF_COUNTS.declared) {
    attempts += 1;
    const a = pick(rng, linked);
    const b = partnerOf(a);
    const blocked = hubSet.has(a) || hubSet.has(b) || at(degree, a) > cap || at(degree, b) > cap;
    if (attempts % 5000 === 0) {
      cap += 1;
    }
    if (!blocked && addPair(a, b)) {
      declare(a, b);
    }
  }

  return { entities, textLinks, declared };
}

// Texte court d'une entree : cite par leur NOM ses cibles AUTO (ce que le
// moteur de liaison retrouverait) et par une mention (@) ses cibles MANUAL.
export function perfEntityContent(
  name: string,
  targets: ({ kind: "AUTO"; name: string } | { kind: "MANUAL"; id: string; name: string })[],
): JSONContent {
  if (targets.length === 0) {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: `${name} veille seul.` }] }],
    };
  }
  const inline: JSONContent[] = [{ type: "text", text: `${name} croise ` }];
  targets.forEach((target, index) => {
    if (index > 0) {
      inline.push({ type: "text", text: index === targets.length - 1 ? " et " : ", " });
    }
    inline.push(
      target.kind === "AUTO"
        ? { type: "text", text: target.name }
        : { type: "mention", attrs: { id: target.id, label: target.name } },
    );
  });
  inline.push({ type: "text", text: "." });
  return { type: "doc", content: [{ type: "paragraph", content: inline }] };
}
