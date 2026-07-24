export interface UploadInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

// Port (ports & adapters) - les services ne connaissent que cette interface,
// jamais le SDK S3 directement (regle §4.2 du CLAUDE.md). Volontairement minimal :
// la validation MIME/magic-bytes (OWASP A10) est la responsabilite du service
// d'upload (src/lib/image-validation.ts), pas de ce port infra.
export interface Storage {
  upload(input: UploadInput): Promise<void>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
