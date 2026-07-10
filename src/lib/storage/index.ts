import { env } from "@/env";
import { S3StorageAdapter } from "./s3-adapter";
import type { Storage } from "./types";

const endpoint = `${env.S3_USE_SSL ? "https" : "http"}://${env.S3_ENDPOINT}:${env.S3_PORT}`;

export const storage: Storage = new S3StorageAdapter({
  endpoint,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  bucket: env.S3_BUCKET,
});

export type { Storage, UploadInput } from "./types";
