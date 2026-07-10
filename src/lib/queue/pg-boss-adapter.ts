import { PgBoss } from "pg-boss";
import type { EnqueueOptions, JobHandler, JobQueue } from "./types";

export class PgBossQueueAdapter implements JobQueue {
  private readonly boss: PgBoss;
  private startPromise: Promise<unknown> | null = null;
  private readonly ensuredQueues = new Set<string>();

  constructor(connectionString: string) {
    this.boss = new PgBoss(connectionString);
  }

  private ensureStarted(): Promise<unknown> {
    this.startPromise ??= this.boss.start();
    return this.startPromise;
  }

  private async ensureQueue(name: string): Promise<void> {
    if (this.ensuredQueues.has(name)) {
      return;
    }
    // policy "short" : au plus 1 job EN ATTENTE par singletonKey (actifs illimites) -
    // c'est le comportement que la policy par defaut ("standard") ne fournit PAS :
    // avec "standard", singletonKey n'est utilise que pour le debounce/throttle
    // (singletonSeconds), pas pour un dedup permanent. Verifie en conditions reelles.
    await this.boss.createQueue(name, { policy: "short" });
    this.ensuredQueues.add(name);
  }

  async enqueue<T extends object>(
    queueName: string,
    data: T,
    options?: EnqueueOptions,
  ): Promise<string | null> {
    await this.ensureStarted();
    await this.ensureQueue(queueName);
    return this.boss.send(
      queueName,
      data,
      options?.singletonKey ? { singletonKey: options.singletonKey } : undefined,
    );
  }

  async work<T extends object>(queueName: string, handler: JobHandler<T>): Promise<void> {
    await this.ensureStarted();
    await this.ensureQueue(queueName);
    await this.boss.work<T>(queueName, async (jobs) => {
      for (const job of jobs) {
        await handler(job.data, { id: job.id });
      }
    });
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true });
  }
}
