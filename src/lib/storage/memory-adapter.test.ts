import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter } from "./memory-adapter";

describe("MemoryStorageAdapter", () => {
  it("stocke un objet uploade et le retrouve via get()", async () => {
    const storage = new MemoryStorageAdapter();

    await storage.upload({ key: "a.txt", body: Buffer.from("hello"), contentType: "text/plain" });

    const stored = storage.get("a.txt");
    expect(stored?.contentType).toBe("text/plain");
    expect(stored?.body.toString()).toBe("hello");
  });

  it("renvoie undefined pour une cle inconnue", () => {
    const storage = new MemoryStorageAdapter();

    expect(storage.get("inconnue")).toBeUndefined();
  });

  it("supprime un objet", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.upload({ key: "a.txt", body: Buffer.from("hello"), contentType: "text/plain" });

    await storage.delete("a.txt");

    expect(storage.get("a.txt")).toBeUndefined();
  });

  it("genere une URL signee deterministe incluant la cle et l'expiration", async () => {
    const storage = new MemoryStorageAdapter();

    const url = await storage.getSignedUrl("a.txt", 120);

    expect(url).toBe("memory://a.txt?expiresIn=120");
  });

  it("utilise 3600 secondes par defaut pour l'expiration", async () => {
    const storage = new MemoryStorageAdapter();

    const url = await storage.getSignedUrl("a.txt");

    expect(url).toBe("memory://a.txt?expiresIn=3600");
  });
});
