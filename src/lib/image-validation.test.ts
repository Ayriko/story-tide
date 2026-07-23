import { describe, expect, it } from "vitest";
import {
  checkImageFileSize,
  IMAGE_TOO_LARGE_MESSAGE,
  MAX_IMAGE_BYTES,
  sniffImageMime,
} from "./image-validation";

describe("sniffImageMime", () => {
  it("reconnait une signature PNG valide", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(sniffImageMime(buffer)).toBe("image/png");
  });

  it("reconnait une signature JPEG valide", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageMime(buffer)).toBe("image/jpeg");
  });

  it("reconnait une signature GIF valide (GIF87a et GIF89a)", () => {
    const gif89a = Buffer.from("GIF89a", "ascii");
    const gif87a = Buffer.from("GIF87a", "ascii");
    expect(sniffImageMime(gif89a)).toBe("image/gif");
    expect(sniffImageMime(gif87a)).toBe("image/gif");
  });

  it("reconnait une signature WebP valide (RIFF....WEBP)", () => {
    const buffer = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // taille, ignoree
      Buffer.from("WEBP", "ascii"),
    ]);
    expect(sniffImageMime(buffer)).toBe("image/webp");
  });

  it("rejette un RIFF qui n'est pas du WebP (mauvais identifiant de conteneur)", () => {
    const buffer = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("AVI ", "ascii"),
    ]);
    expect(sniffImageMime(buffer)).toBeNull();
  });

  it("rejette un fichier texte brut avec une extension trompeuse (faux MIME, TST-SEC-002)", () => {
    const buffer = Buffer.from("ceci n'est pas une image, juste du texte", "utf8");
    expect(sniffImageMime(buffer)).toBeNull();
  });

  it("rejette un buffer vide", () => {
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });

  it("rejette un buffer trop court pour porter une signature complete", () => {
    const buffer = Buffer.from([0x89, 0x50]); // debut de PNG tronque
    expect(sniffImageMime(buffer)).toBeNull();
  });
});

describe("checkImageFileSize (BUG-006)", () => {
  it("accepte un fichier de 2 Mo (sous la limite)", () => {
    expect(checkImageFileSize(2_000_000)).toBeNull();
  });

  it("accepte un fichier exactement a la limite (5 Mo)", () => {
    expect(checkImageFileSize(MAX_IMAGE_BYTES)).toBeNull();
  });

  it("rejette un fichier de 6 Mo (au-dessus de la limite) avec le message exact", () => {
    expect(checkImageFileSize(6_000_000)).toBe(IMAGE_TOO_LARGE_MESSAGE);
  });

  it("rejette un fichier d'un seul octet au-dessus de la limite", () => {
    expect(checkImageFileSize(MAX_IMAGE_BYTES + 1)).toBe(IMAGE_TOO_LARGE_MESSAGE);
  });
});
