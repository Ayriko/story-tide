import { env } from "@/env";
import { PgBossQueueAdapter } from "./pg-boss-adapter";
import type { JobQueue } from "./types";

export const jobQueue: JobQueue = new PgBossQueueAdapter(env.DATABASE_URL);

export type { EnqueueOptions, JobHandler, JobQueue } from "./types";
