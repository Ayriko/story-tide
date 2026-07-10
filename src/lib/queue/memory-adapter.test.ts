import { describe, expect, it, vi } from "vitest";
import { MemoryQueueAdapter } from "./memory-adapter";

describe("MemoryQueueAdapter", () => {
  it("enqueue un job et retourne un id", async () => {
    const queue = new MemoryQueueAdapter();

    const id = await queue.enqueue("link-scan", { entityId: "e1" });

    expect(id).not.toBeNull();
  });

  it("refuse un 2e enqueue avec le meme singletonKey tant que le job est en attente", async () => {
    const queue = new MemoryQueueAdapter();

    const id1 = await queue.enqueue("link-scan", { entityId: "e1" }, { singletonKey: "e1" });
    const id2 = await queue.enqueue("link-scan", { entityId: "e1" }, { singletonKey: "e1" });

    expect(id1).not.toBeNull();
    expect(id2).toBeNull();
  });

  it("n'applique pas le dedup entre singletonKey differentes", async () => {
    const queue = new MemoryQueueAdapter();

    const id1 = await queue.enqueue("link-scan", { entityId: "e1" }, { singletonKey: "e1" });
    const id2 = await queue.enqueue("link-scan", { entityId: "e2" }, { singletonKey: "e2" });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
  });

  it("traite les jobs en attente via drain() en appelant le handler enregistre", async () => {
    const queue = new MemoryQueueAdapter();
    const handler = vi.fn().mockResolvedValue(undefined);

    await queue.work("link-scan", handler);
    await queue.enqueue("link-scan", { entityId: "e1" });
    await queue.drain("link-scan");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ entityId: "e1" }, { id: expect.any(String) });
  });

  it("laisse le job en attente si le handler echoue, puis le retraite au drain suivant", async () => {
    const queue = new MemoryQueueAdapter();
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    await queue.work("link-scan", handler);
    await queue.enqueue("link-scan", { entityId: "e1" }, { singletonKey: "e1" });

    await queue.drain("link-scan");
    const idWhileStillPending = await queue.enqueue(
      "link-scan",
      { entityId: "e1" },
      { singletonKey: "e1" },
    );
    expect(idWhileStillPending).toBeNull();

    await queue.drain("link-scan");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("ne fait rien au drain si aucun handler n'est enregistre pour la queue", async () => {
    const queue = new MemoryQueueAdapter();
    await queue.enqueue("link-scan", { entityId: "e1" });

    await expect(queue.drain("link-scan")).resolves.toBeUndefined();
  });

  it("ne fait rien au drain si un handler est enregistre mais qu'aucun job n'a ete enqueue", async () => {
    const queue = new MemoryQueueAdapter();
    const handler = vi.fn().mockResolvedValue(undefined);
    await queue.work("link-scan", handler);

    await queue.drain("link-scan");

    expect(handler).not.toHaveBeenCalled();
  });
});
