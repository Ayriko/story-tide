import { describe, expect, it } from "vitest";
import {
  InvalidVersionError,
  parseReleaseVersion,
  tagNameFor,
  versionFromTagName,
} from "./version";

describe("parseReleaseVersion", () => {
  it("accepte une version finale X.Y.Z", () => {
    expect(parseReleaseVersion("1.3.0")).toEqual({ version: "1.3.0", isRc: false });
  });

  it("accepte une version -rc.N", () => {
    expect(parseReleaseVersion("1.3.0-rc.1")).toEqual({ version: "1.3.0-rc.1", isRc: true });
  });

  it.each(["1.3", "v1.3.0", "1.3.0-beta.1", "1.3.0-rc", "1.3.0-rc.", "", "1.3.0 "])(
    "rejette %j",
    (raw) => {
      expect(() => parseReleaseVersion(raw)).toThrow(InvalidVersionError);
    },
  );
});

describe("tagNameFor", () => {
  it("prefixe la version par v", () => {
    expect(tagNameFor("1.3.0")).toBe("v1.3.0");
    expect(tagNameFor("1.3.0-rc.1")).toBe("v1.3.0-rc.1");
  });
});

describe("versionFromTagName", () => {
  it("extrait la version d'un tag final", () => {
    expect(versionFromTagName("v1.3.0")).toEqual({ version: "1.3.0", isRc: false });
  });

  it("extrait la version d'un tag rc", () => {
    expect(versionFromTagName("v1.3.0-rc.1")).toEqual({ version: "1.3.0-rc.1", isRc: true });
  });

  it("rejette un tag sans prefixe v", () => {
    expect(() => versionFromTagName("1.3.0")).toThrow(InvalidVersionError);
  });

  it("rejette un tag mal forme", () => {
    expect(() => versionFromTagName("v1.3")).toThrow(InvalidVersionError);
  });
});
