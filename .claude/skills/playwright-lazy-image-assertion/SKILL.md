---
name: playwright-lazy-image-assertion
description: 'Assert that an image really loaded in a Playwright test. Use when an e2e test on an img element fails while the feature works by hand, when toBeVisible passes or fails wrongly on an image, when testing an upload or media round-trip, or whenever the image under test carries loading="lazy", a small fixture (1x1 px), a lazy-loaded gallery, or a redirect-based media route. Keywords — playwright, e2e, img, image, toBeVisible, lazy, loading lazy, naturalWidth, complete, faux negatif, upload, media, MinIO, S3, signed URL, fixture PNG.'
---

# Vérifier qu'une image a réellement chargé (Playwright)

## Le gotcha

`expect(img).toBeVisible()` **ne teste pas** qu'une image a chargé. Playwright
mesure la visibilité DOM/CSS : bounding box non nulle, pas de `display:none`,
pas de `visibility:hidden`. Une image cassée ou en attente peut être
« visible » ; à l'inverse un `<img loading="lazy">` dont la fixture est
minuscule (1×1 px) peut avoir une bounding box jugée nulle et faire échouer le
test **alors que le round-trip fonctionne réellement**.

C'est un faux négatif coûteux : il envoie diagnostiquer une chaîne serveur qui
n'a aucun problème.

## La bonne assertion

```ts
const img = page.getByRole("img", { name: "…" });

await expect
  .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
  .toBe(true);
```

`complete` = le navigateur a fini de traiter la requête. `naturalWidth > 0` =
il en a tiré des pixels (une image cassée a `complete === true` mais
`naturalWidth === 0`). Les deux ensemble, et seulement les deux, signifient
« l'image a réellement chargé ».

`expect.poll` plutôt qu'un `evaluate` sec : avec `loading="lazy"` le chargement
peut démarrer après l'attachement au DOM.

Forcer le déclenchement si l'image est hors viewport :

```ts
await img.scrollIntoViewIfNeeded();
```

## Quand l'assertion échoue et que le doute persiste

Isoler la chaîne serveur **hors navigateur** avant de soupçonner le front :

```bash
curl -sS -c cookies.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"…","password":"…","name":"…"}'

curl -sS -L -b cookies.txt -o /dev/null -w '%{http_code} %{content_type}\n' \
  http://localhost:3000/api/media/<id>
```

Attendu : `200 image/png` après suivi de la redirection (`-L`) vers l'URL
signée. Si c'est vert, le problème est dans l'assertion, pas dans le pipeline.

## À ne pas faire

- `toBeVisible()` seul sur une image dont le chargement est le sujet du test.
- `waitForTimeout()` pour « laisser le temps » — masque le vrai signal.
- Grossir la fixture pour faire passer `toBeVisible()` : ça soigne le symptôme
  et laisse le test incapable de détecter une image cassée.
