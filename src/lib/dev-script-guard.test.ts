import { describe, expect, it } from "vitest";
import { assertLocalDevDatabase, DevScriptRefusedError } from "./dev-script-guard";

const LOCAL = "postgresql://story:pw@localhost:5432/story_tide";

describe("assertLocalDevDatabase", () => {
  it.each([
    LOCAL,
    "postgresql://story:pw@127.0.0.1:5432/story_tide",
    "postgresql://story:pw@[::1]:5432/story_tide",
  ])("accepte une base locale : %s", (databaseUrl) => {
    expect(() => assertLocalDevDatabase({ nodeEnv: "development", databaseUrl })).not.toThrow();
  });

  it("refuse NODE_ENV=production meme sur une base locale", () => {
    expect(() => assertLocalDevDatabase({ nodeEnv: "production", databaseUrl: LOCAL })).toThrow(
      DevScriptRefusedError,
    );
  });

  it("refuse une base distante", () => {
    expect(() =>
      assertLocalDevDatabase({
        nodeEnv: "development",
        databaseUrl: "postgresql://story:pw@db.storytide.fr:5432/story_tide",
      }),
    ).toThrow(/non locale \(db\.storytide\.fr\)/);
  });

  it("refuse une URL absente", () => {
    expect(() => assertLocalDevDatabase({ nodeEnv: undefined, databaseUrl: undefined })).toThrow(
      /absente/,
    );
  });

  it("refuse une URL invalide et chaine la cause", () => {
    let caught: unknown;
    try {
      assertLocalDevDatabase({ nodeEnv: "development", databaseUrl: "pas une url" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DevScriptRefusedError);
    expect(caught).toMatchObject({ cause: expect.any(TypeError) });
  });
});
