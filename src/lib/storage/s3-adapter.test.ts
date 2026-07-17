import { beforeEach, describe, expect, it, vi } from "vitest";

// SDK S3 mocke : on verifie la TRADUCTION adapter -> SDK (quelle Command est
// construite, avec quel input, et avec quelles options le S3Client lui-meme
// est instancie) - le fake memoire (memory-adapter.test.ts) reste le double
// utilise par les tests de service, ce fichier couvre uniquement l'adapter
// reel. vi.hoisted() est necessaire : vi.mock() est hoiste par Vitest
// au-dessus de tout le fichier, donc toute variable qu'une factory
// referme dessus doit elle-meme etre declaree via vi.hoisted() pour eviter
// une ReferenceError (temporal dead zone) au chargement du module.
const { sendMock, s3ClientConstructorMock, getSignedUrlMock, CommandClasses } = vi.hoisted(() => {
  class FakeCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class FakePutObjectCommand extends FakeCommand {}
  class FakeGetObjectCommand extends FakeCommand {}
  class FakeDeleteObjectCommand extends FakeCommand {}

  return {
    sendMock: vi.fn(),
    s3ClientConstructorMock: vi.fn(),
    getSignedUrlMock: vi.fn(),
    CommandClasses: { FakePutObjectCommand, FakeGetObjectCommand, FakeDeleteObjectCommand },
  };
});

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = sendMock;
    constructor(options: unknown) {
      s3ClientConstructorMock(options);
    }
  }
  return {
    S3Client: FakeS3Client,
    PutObjectCommand: CommandClasses.FakePutObjectCommand,
    GetObjectCommand: CommandClasses.FakeGetObjectCommand,
    DeleteObjectCommand: CommandClasses.FakeDeleteObjectCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

const { S3StorageAdapter } = await import("./s3-adapter");

const OPTIONS = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  accessKeyId: "ci",
  secretAccessKey: "ci-secret",
  bucket: "story-tide-ci",
};

describe("S3StorageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("construit le S3Client avec forcePathStyle (requis par MinIO)", () => {
    const adapter = new S3StorageAdapter(OPTIONS);

    expect(adapter).toBeInstanceOf(S3StorageAdapter);
    expect(s3ClientConstructorMock).toHaveBeenCalledWith({
      endpoint: OPTIONS.endpoint,
      region: OPTIONS.region,
      credentials: { accessKeyId: OPTIONS.accessKeyId, secretAccessKey: OPTIONS.secretAccessKey },
      forcePathStyle: true,
    });
  });

  it("upload() envoie un PutObjectCommand avec Bucket/Key/Body/ContentType", async () => {
    const adapter = new S3StorageAdapter(OPTIONS);
    const body = Buffer.from("hello");

    await adapter.upload({ key: "a.txt", body, contentType: "text/plain" });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]?.[0] as InstanceType<
      typeof CommandClasses.FakePutObjectCommand
    >;
    expect(command).toBeInstanceOf(CommandClasses.FakePutObjectCommand);
    expect(command.input).toEqual({
      Bucket: OPTIONS.bucket,
      Key: "a.txt",
      Body: body,
      ContentType: "text/plain",
    });
  });

  it("delete() envoie un DeleteObjectCommand avec Bucket/Key", async () => {
    const adapter = new S3StorageAdapter(OPTIONS);

    await adapter.delete("a.txt");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]?.[0] as InstanceType<
      typeof CommandClasses.FakeDeleteObjectCommand
    >;
    expect(command).toBeInstanceOf(CommandClasses.FakeDeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: OPTIONS.bucket, Key: "a.txt" });
  });

  it("getSignedUrl() utilise 3600s par defaut et construit un GetObjectCommand", async () => {
    getSignedUrlMock.mockResolvedValue("https://signed.example/a.txt");
    const adapter = new S3StorageAdapter(OPTIONS);

    const url = await adapter.getSignedUrl("a.txt");

    expect(url).toBe("https://signed.example/a.txt");
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const [client, command, presignOptions] = getSignedUrlMock.mock.calls[0] as [
      unknown,
      InstanceType<typeof CommandClasses.FakeGetObjectCommand>,
      { expiresIn: number },
    ];
    expect(client).toBeDefined();
    expect(command).toBeInstanceOf(CommandClasses.FakeGetObjectCommand);
    expect(command.input).toEqual({ Bucket: OPTIONS.bucket, Key: "a.txt" });
    expect(presignOptions).toEqual({ expiresIn: 3600 });
  });

  it("getSignedUrl() respecte une expiration personnalisee", async () => {
    getSignedUrlMock.mockResolvedValue("https://signed.example/a.txt?exp=120");
    const adapter = new S3StorageAdapter(OPTIONS);

    await adapter.getSignedUrl("a.txt", 120);

    const presignOptions = getSignedUrlMock.mock.calls[0]?.[2] as { expiresIn: number };
    expect(presignOptions).toEqual({ expiresIn: 120 });
  });
});
