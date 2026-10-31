import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_TYPE_ICONS,
  GROUP_DEFAULT_ICON,
  customTypeKey,
  parseTypeKey,
  resolveEntityType,
  selectableTypes,
  toEntityListItem,
  toFolderTreeView,
  type WorldTypeCatalog,
} from "./entity-types";
import { ENTITY_TYPE_GROUPS } from "./entity-schemas";

const SHIP = { id: "ct-ship", label: "Vaisseau", group: "Objets", icon: "ship" };
const EMPTY: WorldTypeCatalog = { custom: [], hidden: [] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveEntityType", () => {
  it("natif : cle native, libelle et groupe du registre, icone du groupe", () => {
    expect(resolveEntityType({ type: "character", customTypeId: null }, EMPTY)).toEqual({
      key: "character",
      label: "Personnage",
      group: "Personnages",
      icon: "user",
      isCustom: false,
      isHidden: false,
    });
  });

  it("natif masque : resolu normalement, marque isHidden", () => {
    const resolved = resolveEntityType(
      { type: "prophecy", customTypeId: null },
      { custom: [], hidden: ["prophecy"] },
    );
    expect(resolved).toMatchObject({ key: "prophecy", label: "Prophétie", isHidden: true });
  });

  it("natif inconnu (donnee legacy) : libelle brut, groupe Divers", () => {
    expect(resolveEntityType({ type: "legacy", customTypeId: null }, EMPTY)).toMatchObject({
      key: "legacy",
      label: "legacy",
      group: "Divers",
      icon: "sticky-note",
    });
  });

  it("personnalise : cle custom:<id>, libelle, groupe et icone du catalogue", () => {
    expect(
      resolveEntityType(
        { type: "custom", customTypeId: "ct-ship" },
        { custom: [SHIP], hidden: [] },
      ),
    ).toEqual({
      key: "custom:ct-ship",
      label: "Vaisseau",
      group: "Objets",
      icon: "ship",
      isCustom: true,
      isHidden: false,
    });
  });

  it("personnalise a icone inconnue : icone du groupe ; groupe inconnu : Divers", () => {
    const catalog = {
      custom: [{ id: "a", label: "A", group: "Inexistant", icon: "inconnue" }],
      hidden: [],
    };
    expect(resolveEntityType({ type: "custom", customTypeId: "a" }, catalog)).toMatchObject({
      group: "Divers",
      icon: GROUP_DEFAULT_ICON.Divers,
    });
  });

  it("personnalise orphelin : Type inconnu, Divers, et console.error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveEntityType({ type: "custom", customTypeId: "disparu" }, EMPTY)).toEqual({
      key: "custom:disparu",
      label: "Type inconnu",
      group: "Divers",
      icon: "sticky-note",
      isCustom: true,
      isHidden: false,
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe("parseTypeKey / customTypeKey", () => {
  it("aller-retour d'une cle personnalisee", () => {
    expect(parseTypeKey(customTypeKey("abc"))).toEqual({ type: "custom", customTypeId: "abc" });
  });

  it("cle native", () => {
    expect(parseTypeKey("weapon")).toEqual({ type: "weapon", customTypeId: null });
  });

  it("cle inconnue, sentinelle nue ou id vide : null", () => {
    expect(parseTypeKey("dragon")).toBeNull();
    expect(parseTypeKey("custom")).toBeNull();
    expect(parseTypeKey("custom:")).toBeNull();
  });
});

describe("selectableTypes", () => {
  it("sans parametrage : les 26 natifs dans les 8 groupes, ordre stable", () => {
    const grouped = selectableTypes(EMPTY);
    expect(grouped.map(({ group }) => group)).toEqual([...ENTITY_TYPE_GROUPS]);
    expect(grouped.flatMap(({ types }) => types)).toHaveLength(26);
  });

  it("exclut les natifs masques", () => {
    const keys = selectableTypes({ custom: [], hidden: ["prophecy"] })
      .flatMap(({ types }) => types)
      .map(({ key }) => key);
    expect(keys).not.toContain("prophecy");
    expect(keys).toHaveLength(25);
  });

  it("omet un groupe dont tous les types sont masques", () => {
    const groups = selectableTypes({ custom: [], hidden: ["character"] }).map(({ group }) => group);
    expect(groups).not.toContain("Personnages");
  });

  it("place les personnalises dans leur groupe, apres les natifs, tries par libelle", () => {
    const catalog = {
      custom: [SHIP, { id: "ct-bag", label: "Besace", group: "Objets", icon: "package" }],
      hidden: [],
    };
    const objets = selectableTypes(catalog).find(({ group }) => group === "Objets");
    expect(objets?.types.map(({ label }) => label)).toEqual([
      "Objet",
      "Arme",
      "Armure",
      "Artéfact",
      "Besace",
      "Vaisseau",
    ]);
  });

  it("alsoKeep conserve le type courant meme masque", () => {
    const keys = selectableTypes({ custom: [], hidden: ["prophecy"] }, "prophecy")
      .flatMap(({ types }) => types)
      .map(({ key }) => key);
    expect(keys).toContain("prophecy");
  });
});

describe("CUSTOM_TYPE_ICONS", () => {
  it("contient l'icone par defaut de chaque groupe", () => {
    for (const icon of Object.values(GROUP_DEFAULT_ICON)) {
      expect(CUSTOM_TYPE_ICONS).toContain(icon);
    }
  });
});

describe("toEntityListItem / toFolderTreeView (KAN-84, blindage des affichages)", () => {
  const catalog: WorldTypeCatalog = { custom: [SHIP], hidden: [] };
  const raw = {
    id: "e1",
    name: "Albatros",
    folderId: "f1",
    type: "custom",
    customTypeId: SHIP.id,
    // Champs d'une Entity complete : ne doivent jamais passer dans le DTO.
    content: { type: "doc" },
    plainText: "texte prive",
  };

  it("porte le type resolu et AUCUN champ brut (type, customTypeId, contenu)", () => {
    const item = toEntityListItem(raw, catalog);

    expect(item).toEqual({
      id: "e1",
      name: "Albatros",
      folderId: "f1",
      resolvedType: resolveEntityType(raw, catalog),
    });
    expect(item.resolvedType.label).toBe("Vaisseau");
    expect(Object.keys(item).sort()).toEqual(["folderId", "id", "name", "resolvedType"]);
  });

  it("resout recursivement l'arbre de dossiers sans conserver les champs bruts", () => {
    const tree = toFolderTreeView(
      [
        {
          id: "f1",
          name: "Flotte",
          children: [{ id: "f2", name: "Epaves", children: [], entities: [] }],
          entities: [raw],
        },
      ],
      catalog,
    );

    expect(tree).toEqual([
      {
        id: "f1",
        name: "Flotte",
        children: [{ id: "f2", name: "Epaves", children: [], entities: [] }],
        entities: [toEntityListItem(raw, catalog)],
      },
    ]);
    expect(Object.keys(tree[0] ?? {}).sort()).toEqual(["children", "entities", "id", "name"]);
  });
});
