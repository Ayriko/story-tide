/**
 * Dérive les assets web de l'artwork de la page (auth) depuis le master de
 * l'artiste (hors dépôt, cf. docs/design/).
 *
 * PROFIL COULEUR — la 1re livraison portait une étiquette ICC "Display P3"
 * alors que le travail était en sRGB : l'export avait collé le profil de
 * l'environnement sans convertir. Prouvé par comparaison avec le réexport
 * sRGB de l'artiste : pixels rigoureusement identiques (écart max 0/255),
 * seule l'étiquette diffère. Aucune conversion ne doit donc être appliquée.
 * On travaille désormais depuis artwork-master-srgb.png, correctement tagué.
 *
 * FORMAT — la page utilise background-image via --bg-image (KAN-36), pas
 * next/image : aucune optimisation à l'exécution, on livre donc les variantes
 * finales, négociées côté CSS par image-set().
 *
 * Usage : node scripts/build-artwork.mjs [chemin-du-master.png]
 */
import sharp from "sharp";

const src = process.argv[2] ?? "artwork-master-srgb.png";
const widths = [1920, 2880];

const meta = await sharp(src).metadata();
console.log(
  `entrée : ${meta.width}x${meta.height} ${meta.space} alpha=${meta.hasAlpha} icc=${meta.icc ? "oui" : "non"}`,
);

for (const w of widths) {
  const base = sharp(src)
    // pas d'appel ICC : sharp strippe les métadonnées par défaut, les pixels
    // partent bruts et le navigateur les lit en sRGB — ce qu'on veut ici.
    .removeAlpha()
    .resize({ width: w });

  for (const [fmt, opts] of [
    ["avif", { quality: 80 }],
    ["webp", { quality: 82, effort: 5 }],
  ]) {
    const out = `public/artwork/login-hero-${w}.${fmt}`;
    const i = await base.clone()[fmt](opts).toFile(out);
    console.log(`  ${out.padEnd(38)} ${Math.round(i.size / 1024)} Ko`);
  }
}
