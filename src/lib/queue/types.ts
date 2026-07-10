export type JobHandler<T> = (data: T, job: { id: string }) => Promise<void>;

export interface EnqueueOptions {
  singletonKey?: string;
}

// Port (ports & adapters) - les services ne connaissent que cette interface,
// jamais pg-boss directement (regle §4.2 du CLAUDE.md).
export interface JobQueue {
  enqueue<T extends object>(
    queueName: string,
    data: T,
    options?: EnqueueOptions,
  ): Promise<string | null>;
  work<T extends object>(queueName: string, handler: JobHandler<T>): Promise<void>;
  stop(): Promise<void>;
}
