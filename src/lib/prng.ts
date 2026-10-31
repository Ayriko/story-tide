// Generateur pseudo-aleatoire deterministe, zero dependance : seed de
// performance (perf-world-generator.ts) et ciel de fond par monde
// (sky-backdrop.ts).

// PRNG mulberry32 : 32 bits d'etat, periode suffisante pour quelques milliers
// de tirages, zero dependance.
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
