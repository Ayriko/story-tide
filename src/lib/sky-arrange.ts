import type { Core, SingularElementArgument } from "cytoscape";
import {
  communityLayoutOptions,
  isolatedArcPositions,
  orientBlocks,
  packCommunities,
  refineLayoutOptions,
  type CommunityLink,
  type OrientableBlock,
} from "./graph-layout";
import {
  communityGroups,
  DECLARED_WEIGHT,
  detectCommunities,
  TEXT_WEIGHT,
} from "./sky-communities";
import { SMALL_WORLD_STARS } from "./sky-detail";

// Disposition complete du ciel (KAN-85, retours de validation C2), appelee
// au premier affichage et par « Reorganiser » - jamais pour un monde deja
// dispose. Agit sur une instance Cytoscape (navigateur ou headless : testee
// avec le vrai fcose) :
// 1. constellations : communautes du graphe pondere (sky-communities.ts) ;
// 2. chaque constellation est disposee SEULE par fcose, compacte, noms
//    compris dans la taille des etoiles ;
// 3. rangement des blocs dans les proportions de la scene (packCommunities) ;
// 4. orientation de chaque bloc vers ses ponts (orientBlocks) ;
// 5. finition : passe fcose courte sur tout le ciel, ponts faibles - une
//    etoile glisse vers le cote de son bloc qui fait face a ses ponts ;
// 6. etoiles sans lien : semees sur un arc au bord bas du ciel.

// Etoile = entree du monde (data(typeKey)) ; ligne = arete du monde
// (data(kind)). Poignee de liaison et fantomes d'edgehandles exclus.
export function isSkyStar(element: SingularElementArgument): boolean {
  return element.isNode() && element.data("typeKey") !== undefined;
}
export function isSkyLine(element: SingularElementArgument): boolean {
  return element.isEdge() && element.data("kind") !== undefined;
}

function lineWeight(kind: unknown): number {
  return kind === "declared" ? DECLARED_WEIGHT : TEXT_WEIGHT;
}

export function skyCommunities(cy: Core): Map<string, string> {
  return detectCommunities(
    cy
      .nodes()
      .filter(isSkyStar)
      .map((node) => node.id()),
    cy
      .edges()
      .filter(isSkyLine)
      .edges()
      .map((edge) => ({
        source: edge.source().id(),
        target: edge.target().id(),
        weight: lineWeight(edge.data("kind")),
      })),
  );
}

export function arrangeSky(cy: Core, targetAspect: number): void {
  const stars = cy.nodes().filter(isSkyStar).nodes();
  const lines = cy.edges().filter(isSkyLine).edges();
  const communities = skyCommunities(cy);
  const linkedIds = new Set<string>();
  lines.forEach((edge) => {
    linkedIds.add(edge.source().id());
    linkedIds.add(edge.target().id());
  });
  // Petit monde : tous les noms s'affichent, ils comptent dans la taille des
  // etoiles (aucun chevauchement). Noms affiches le temps du calcul (taille
  // reelle) ; le niveau de detail est reapplique ensuite par l'appelant.
  const includeLabels = stars.length <= SMALL_WORLD_STARS;
  cy.batch(() => {
    stars.addClass("is-named");
  });

  // 2. Chaque constellation seule.
  const blocks: OrientableBlock[] = [];
  for (const group of communityGroups(communities)) {
    if (!group.some((id) => linkedIds.has(id))) {
      continue;
    }
    const members = new Set(group);
    const nodes = stars.filter((node) => members.has(node.id())).nodes();
    nodes
      .union(nodes.edgesWith(nodes).filter(isSkyLine))
      .layout(communityLayoutOptions(includeLabels, group.length))
      .run();
    const box = nodes.boundingBox({ includeLabels: true });
    const cx = (box.x1 + box.x2) / 2;
    const cy0 = (box.y1 + box.y2) / 2;
    blocks.push({
      id: group[0] ?? "",
      width: box.w,
      height: box.h,
      members: new Map(
        nodes.map((node) => [
          node.id(),
          { x: node.position("x") - cx, y: node.position("y") - cy0 },
        ]),
      ),
    });
  }

  // 3-4. Rangement des blocs, puis orientation vers les ponts.
  const bridges: { a: string; b: string; weight: number }[] = [];
  const links: CommunityLink[] = [];
  lines.forEach((edge) => {
    const a = edge.source().id();
    const b = edge.target().id();
    const ca = communities.get(a);
    const cb = communities.get(b);
    if (ca && cb && ca !== cb) {
      const weight = lineWeight(edge.data("kind"));
      bridges.push({ a, b, weight });
      links.push({ a: ca, b: cb, weight });
    }
  });
  const centers = packCommunities(blocks, links, targetAspect);
  const oriented = orientBlocks(blocks, centers, bridges);
  cy.batch(() => {
    for (const [id, position] of oriented) {
      cy.getElementById(id).position(position);
    }
  });

  // 5. Finition, constellation par constellation : les etoiles des autres
  // blocs reliees par un pont sont figees, le bloc est recentre ensuite.
  for (const block of blocks) {
    const center = centers.get(block.id);
    const nodes = stars.filter((node) => block.members.has(node.id())).nodes();
    const partners = nodes
      .neighborhood()
      .nodes()
      .filter((node) => isSkyStar(node) && !block.members.has(node.id()))
      .nodes();
    if (!center || partners.empty()) {
      continue;
    }
    const fixed = partners.map((node) => ({
      nodeId: node.id(),
      position: { x: node.position("x"), y: node.position("y") },
    }));
    const scope = nodes.union(partners);
    scope
      .union(scope.edgesWith(scope).filter(isSkyLine))
      .layout(refineLayoutOptions(communities, fixed, includeLabels, block.members.size))
      .run();
    const box = nodes.boundingBox({ includeLabels: true });
    const dx = center.x - (box.x1 + box.x2) / 2;
    const dy = center.y - (box.y1 + box.y2) / 2;
    cy.batch(() => {
      nodes.forEach((node) => {
        node.position({ x: node.position("x") + dx, y: node.position("y") + dy });
      });
    });
  }
  const linked = stars.filter((node) => linkedIds.has(node.id())).nodes();

  // 6. Etoiles sans lien.
  const bounds = linked.nonempty() ? linked.boundingBox({ includeLabels: true }) : null;
  const arc = isolatedArcPositions(
    stars.filter((node) => !linkedIds.has(node.id())).map((node) => node.id()),
    bounds,
  );
  cy.batch(() => {
    for (const [id, position] of arc) {
      cy.getElementById(id).position(position);
    }
  });
}
