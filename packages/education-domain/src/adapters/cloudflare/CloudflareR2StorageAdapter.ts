
import { IStorage, StoredFile, UploadFileInput } from '../../ports';
import { Buffer } from 'node:buffer';

export class CloudflareR2StorageAdapter implements IStorage {
  private bucket: R2Bucket;
  private publicUrl: string;

  constructor(bucket: R2Bucket, publicUrl: string) {
    this.bucket = bucket;
    this.publicUrl = publicUrl;
  }

  async upload(input: UploadFileInput): Promise<StoredFile> {
    const id = crypto.randomUUID();
    const key = input.key || id;
    
    await this.bucket.put(key, input.data, {
      httpMetadata: {
        contentType: input.mimeType,
      },
      customMetadata: input.metadata,
    });

    return {
      id,
      key,
      url: `${this.publicUrl}/${key}`,
      size: input.data.byteLength,
      mimeType: input.mimeType,
      createdAt: new Date(),
      metadata: input.metadata,
    };
  }

  async download(key: string): Promise<Buffer | null> {
    const object = await this.bucket.get(key);
    if (!object) {
      return null;
    }
    const arrayBuffer = await object.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async getUrl(key: string): Promise<string> {
    return `${this.publicUrl}/${key}`;
  }
}
