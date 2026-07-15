/**
 * Story Tide — src/lib/linker/aho-corasick.ts
 * ------------------------------------------------------------------
 * Moteur de détection multi-motifs (Aho-Corasick), cœur de la liaison
 * automatique d'entités. TypeScript pur, ZÉRO dépendance (spec §4.4,
 * C2.2.1 : testable isolément ; C2.2.2 : 100 % couvert par tests unitaires).
 *
 * Principe : on compile UNE FOIS un automate à partir du dictionnaire
 * (noms + alias des entités d'un monde), puis chaque texte est parcouru
 * en UN SEUL passage, en temps ~O(longueur du texte), quasi indépendant
 * du nombre de motifs. C'est la parade n°1 au risque principal.
 *
 * Ce module reste volontairement "bête" : il trouve des occurrences.
 * Les responsabilités suivantes vivent AILLEURS (couche service/worker) :
 *   - cache de l'automate par monde + invalidation (spec §4.4.2)
 *   - exclusion de l'auto-mention, filtre LinkIgnore (spec §4.4.4)
 *   - écriture des Relations (origin=AUTO, jamais écraser MANUAL)
 */

import { normalizeForMatch } from "./normalize";

/** Un motif à détecter : la forme de surface + l'id de l'entité liée. */
export interface Pattern {
  /** Id de l'entité (plusieurs motifs peuvent pointer la même entité : nom + alias). */
  entityId: string;
  /** Forme telle que saisie par l'utilisateur (affichage). */
  term: string;
}

/** Une occurrence trouvée dans le texte scanné. */
export interface Match {
  entityId: string;
  /** Forme du dictionnaire qui a matché (utile pour l'UI de confirmation). */
  term: string;
  /** Bornes dans le texte ORIGINAL : [start, end) — indices UTF-16. */
  start: number;
  end: number;
}

/** Vrai si le caractère fait partie d'un "mot" (lettres/chiffres Unicode). */
function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

/** Nœud de l'automate (représentation par index, plus simple à sérialiser/tester). */
interface Node {
  /** Transitions : caractère normalisé → index du nœud enfant. */
  children: Map<string, number>;
  /** Lien d'échec : plus long suffixe propre qui est aussi préfixe d'un motif. */
  fail: number;
  /** Indices (dans `patterns`) des motifs qui SE TERMINENT sur ce nœud. */
  outputs: number[];
}

export class AhoCorasick {
  private readonly nodes: Node[] = [{ children: new Map(), fail: 0, outputs: [] }];
  private readonly patterns: Pattern[] = [];
  /** Longueur normalisée de chaque motif (pour retrouver le start d'un match). */
  private readonly patternLengths: number[] = [];

  /**
   * Construit l'automate à partir du dictionnaire complet du monde
   * (Entity.name + Entity.aliases[], cf. modèle Prisma §4.3).
   * La construction est en O(somme des longueurs des motifs).
   */
  constructor(patterns: Pattern[]) {
    for (const p of patterns) this.addPattern(p);
    this.buildFailureLinks();
  }

  /**
   * Accès à un nœud par index. Tous les index manipulés dans cette classe
   * (0, `fail`, ou une valeur retournée par `children.get()` déjà vérifiée
   * non-undefined) référencent forcément un nœud existant du trie — c'est
   * un invariant de construction, jamais une possibilité runtime. On
   * centralise l'assertion ici plutôt que de la répéter à chaque accès
   * (cf. CLAUDE.md : assertion justifiée en commentaire, pas un `as` de
   * complaisance).
   */
  private at(index: number): Node {
    return this.nodes[index] as Node;
  }

  /** Insère un motif dans le trie (phase 1 de la construction). */
  private addPattern(pattern: Pattern): void {
    const normalized = normalizeForMatch(pattern.term).trim();
    if (normalized.length === 0) return; // motif vide : ignoré silencieusement

    let current = 0;
    for (const ch of normalized) {
      let next = this.at(current).children.get(ch);
      if (next === undefined) {
        next = this.nodes.length;
        this.nodes.push({ children: new Map(), fail: 0, outputs: [] });
        this.at(current).children.set(ch, next);
      }
      current = next;
    }
    this.patterns.push(pattern);
    this.patternLengths.push(normalized.length);
    this.at(current).outputs.push(this.patterns.length - 1);
  }

  /**
   * Calcule les liens d'échec en largeur (BFS) — phase 2.
   * Un nœud hérite aussi des sorties de son lien d'échec : ainsi, à chaque
   * position du texte, TOUTES les occurrences qui se terminent là sont émises
   * (y compris un motif suffixe d'un autre, ex. "Roi" dans "Roi-Sorcier").
   */
  private buildFailureLinks(): void {
    const queue: number[] = [];
    for (const child of this.at(0).children.values()) {
      this.at(child).fail = 0;
      queue.push(child);
    }
    while (queue.length > 0) {
      const current = queue.shift() as number;
      for (const [ch, child] of this.at(current).children) {
        // Remonte les liens d'échec jusqu'à trouver une transition sur `ch`.
        let fail = this.at(current).fail;
        while (fail !== 0 && !this.at(fail).children.has(ch)) {
          fail = this.at(fail).fail;
        }
        const target = this.at(fail).children.get(ch);
        this.at(child).fail = target !== undefined && target !== child ? target : 0;
        this.at(child).outputs.push(...this.at(this.at(child).fail).outputs);
        queue.push(child);
      }
    }
  }

  /**
   * Scanne un texte (le `plainText` d'une fiche) en un seul passage.
   * Post-traitements intégrés, conformes à la spec §4.4.4 :
   *   1. frontières de mots : "Ann" ne matche pas dans "Annexe" ;
   *   2. plus long match prioritaire, sans chevauchement : sur
   *      "Jon Neige", le motif "Jon Neige" gagne sur "Jon" ;
   *   3. les égalités exactes de bornes sont TOUTES conservées
   *      (deux entités homonymes → ambiguïté résolue en amont, Phase 2).
   *
   * Politique de résolution (à noter pour la relecture) : le tri par
   * position de DÉBUT croissante puis longueur décroissante fait gagner,
   * à chaque point de départ, le plus long match qui y commence — mais un
   * match plus long démarrant PLUS TARD peut être supprimé par un match
   * plus court déjà retenu s'il chevauche. C'est un choix "leftmost-match"
   * classique (pas une recherche du recouvrement globalement optimal),
   * suffisant pour la Phase 1 (verrouillé par test ci-dessous).
   */
  search(text: string): Match[] {
    const normalized = normalizeForMatch(text);
    const raw: Match[] = [];

    // --- Passage unique sur le texte normalisé -------------------------
    let state = 0;
    for (let i = 0; i < normalized.length; i++) {
      // i < normalized.length garantit un caractère défini à cet indice.
      const ch = normalized[i] as string;
      while (state !== 0 && !this.at(state).children.has(ch)) {
        state = this.at(state).fail;
      }
      state = this.at(state).children.get(ch) ?? 0;

      for (const patternIndex of this.at(state).outputs) {
        // patternIndex provient de `outputs`, toujours un index valide dans
        // `patterns`/`patternLengths` (poussés de pair à chaque motif inséré).
        const length = this.patternLengths[patternIndex] as number;
        const start = i - length + 1;
        const end = i + 1;
        // Frontières de mots vérifiées sur le texte ORIGINAL.
        if (isWordChar(text[start - 1]) || isWordChar(text[end])) continue;
        const p = this.patterns[patternIndex] as Pattern;
        raw.push({ entityId: p.entityId, term: p.term, start, end });
      }
    }

    // --- Plus long match prioritaire, sans chevauchement ---------------
    raw.sort((a, b) => a.start - b.start || b.end - a.end);
    const result: Match[] = [];
    let lastEnd = -1;
    let keptStart = -1;
    let keptEnd = -1;
    for (const m of raw) {
      if (m.start === keptStart && m.end === keptEnd) {
        result.push(m); // homonyme sur les mêmes bornes : conservé (ambiguïté amont)
      } else if (m.start >= lastEnd) {
        result.push(m);
        lastEnd = m.end;
        keptStart = m.start;
        keptEnd = m.end;
      }
    }
    return result;
  }
}
