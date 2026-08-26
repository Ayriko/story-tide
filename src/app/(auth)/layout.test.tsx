import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthLayout from "./layout";

describe("AuthLayout", () => {
  it("porte la classe qui branche l'artwork de marque sur la racine", () => {
    const { container } = render(
      <AuthLayout>
        <p>Contenu</p>
      </AuthLayout>,
    );

    expect(container.querySelector(".auth-artwork")).toBeInTheDocument();
  });

  it("rend les enfants dans le main de la page", () => {
    render(
      <AuthLayout>
        <p>Contenu du formulaire</p>
      </AuthLayout>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("Contenu du formulaire");
  });

  // Le fichier CSS reference les 4 derivees par chemin litteral - un simple
  // oubli de `git add public/artwork` (repertoire non suivi a ce jour)
  // produirait un 404 silencieux : le navigateur retomberait sur le degrade
  // de repli sans qu'aucun test ne le signale. C'est le seul mode de
  // defaillance realiste de cette feature.
  it("les 4 derivees de l'artwork existent sur le disque", () => {
    const derivatives = [
      "login-hero-1920.avif",
      "login-hero-2880.avif",
      "login-hero-1920.webp",
      "login-hero-2880.webp",
    ];

    for (const file of derivatives) {
      expect(existsSync(join(process.cwd(), "public", "artwork", file))).toBe(true);
    }
  });
});
