export interface StoredObject {
  key: string;
  contentType: string;
  sizeBytes: number;
}

export interface ObjectStorage {
  createUploadUrl(input: { tenantId: string; key: string; contentType: string; maxBytes: number }): Promise<{ url: string; expiresAt: string }>;
  deleteObject(input: { tenantId: string; key: string }): Promise<void>;
}

export function buildTenantObjectKey(tenantId: string, objectId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `${tenantId}/${objectId}/${safeName}`;
}
