---
name: shadcn-add-cn-import-parasite
description: >
  Composants générés par npx shadcn add qui importent cn depuis un paquet
  "cn" au lieu de @/lib/utils, et ajoutent une dépendance npm parasite.
  Déclencheurs : npx shadcn add, import { cn } from "cn", dépendance cn dans
  package.json, components.json aliases, chart, table, badge, select,
  Module not found cn, composant shadcn généré.
---

# `npx shadcn add` peut générer `import { cn } from "cn"`

## Le symptôme

Après `npx shadcn add chart table badge select` (13/10/2026), les nouveaux
fichiers de `src/components/ui/` contiennent :

```ts
import { cn } from "cn";
```

et `package.json` a gagné une dépendance **`cn`** qui n'a rien à voir avec le
helper du projet.

## La cause

Le générateur a mal résolu l'alias `utils` de `components.json` (pourtant
correct : `"utils": "@/lib/utils"`) et a pris le nom nu comme un paquet npm,
qu'il a installé.

## La solution

```powershell
npm uninstall cn
```

Puis, dans chaque fichier généré :

```ts
import { cn } from "@/lib/utils";
```

et `npx prettier --write src/components/ui/<fichiers>`.

## Règle

Après tout `npx shadcn add` : `git diff package.json` (aucune dépendance
inattendue) et `grep -rn 'from "cn"' src/components/ui/` (zéro résultat)
avant de continuer.
