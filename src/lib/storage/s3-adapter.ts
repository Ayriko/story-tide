import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Storage, UploadInput } from "./types";

export interface S3StorageAdapterOptions {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 3600;

export class S3StorageAdapter implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageAdapterOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      // Requis par MinIO (adressage par chemin, pas par sous-domaine virtuel).
      forcePathStyle: true,
    });
  }

  async upload(input: UploadInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
