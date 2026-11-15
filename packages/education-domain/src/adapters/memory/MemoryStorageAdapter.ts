
import { IStorage, StoredFile, UploadFileInput } from '../../ports';

export class MemoryStorageAdapter implements IStorage {
  private files: Map<string, StoredFile & { data: Buffer }> = new Map();

  async upload(input: UploadFileInput): Promise<StoredFile> {
    const id = crypto.randomUUID();
    const file: StoredFile & { data: Buffer } = {
      id,
      key: input.key,
      url: `https://example.com/storage/${input.key}`,
      size: input.data.length,
      mimeType: input.mimeType,
      createdAt: new Date(),
      metadata: input.metadata,
      data: input.data,
    };
    this.files.set(input.key, file);
    return file;
  }

  async download(key: string): Promise<Buffer | null> {
    const file = this.files.get(key);
    if (!file) return null;
    return file.data;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async getUrl(key: string): Promise<string> {
    const file = this.files.get(key);
    if (!file) throw new Error('File not found');
    return file.url;
  }
}
