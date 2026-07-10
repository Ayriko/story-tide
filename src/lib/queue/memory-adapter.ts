import type { EnqueueOptions, JobHandler, JobQueue } from "./types";

interface MemoryJob {
  id: string;
  data: object;
  singletonKey: string | undefined;
}

// Fake en memoire - reserve aux tests unitaires (services qui dependent du port
// JobQueue). Reproduit le comportement pg-boss exploite par la spec : un seul job
// en attente par singletonKey (§4.4.3 - "1 job de liaison en attente par fiche").
export class MemoryQueueAdapter implements JobQueue {
  private readonly jobs = new Map<string, MemoryJob[]>();
  private readonly handlers = new Map<string, JobHandler<object>>();
  private nextId = 1;

  async enqueue<T extends object>(
    queueName: string,
    data: T,
    options?: EnqueueOptions,
  ): Promise<string | null> {
    const pending = this.jobs.get(queueName) ?? [];

    if (
      options?.singletonKey !== undefined &&
      pending.some((job) => job.singletonKey === options.singletonKey)
    ) {
      return null;
    }

    const id = `memory-job-${this.nextId++}`;
    pending.push({ id, data, singletonKey: options?.singletonKey });
    this.jobs.set(queueName, pending);
    return id;
  }

  async work<T extends object>(queueName: string, handler: JobHandler<T>): Promise<void> {
    this.handlers.set(queueName, handler as JobHandler<object>);
  }

  async stop(): Promise<void> {
    // Rien a arreter en memoire.
  }

  // Reserve aux tests : traite les jobs en attente d'une queue en appelant le
  // handler enregistre. Un job qui fait echouer le handler reste en attente
  // (reproduit la semantique de retry de pg-boss).
  async drain(queueName: string): Promise<void> {
    const handler = this.handlers.get(queueName);
    if (!handler) {
      return;
    }

    const pending = this.jobs.get(queueName) ?? [];
    const remaining: MemoryJob[] = [];

    for (const job of pending) {
      try {
        await handler(job.data, { id: job.id });
      } catch {
        remaining.push(job);
      }
    }

    this.jobs.set(queueName, remaining);
  }
}
