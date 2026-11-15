
export interface StoredFile {
  id: string;
  key: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface UploadFileInput {
  key: string;
  data: Buffer;
  mimeType: string;
  metadata?: Record<string, any>;
}

export interface IStorage {
  upload(input: UploadFileInput): Promise<StoredFile>;
  download(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}
