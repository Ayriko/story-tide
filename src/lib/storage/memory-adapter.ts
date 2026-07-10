import type { Storage, UploadInput } from "./types";

interface StoredObject {
  body: Buffer | Uint8Array;
  contentType: string;
}

// Fake en memoire - reserve aux tests unitaires (services qui dependent du port Storage).
export class MemoryStorageAdapter implements Storage {
  private readonly objects = new Map<string, StoredObject>();

  async upload(input: UploadInput): Promise<void> {
    this.objects.set(input.key, { body: input.body, contentType: input.contentType });
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return `memory://${key}?expiresIn=${expiresInSeconds}`;
  }

  // Reserve aux tests : inspecter ce qui a ete stocke sans passer par une URL signee.
  get(key: string): StoredObject | undefined {
    return this.objects.get(key);
  }
}
