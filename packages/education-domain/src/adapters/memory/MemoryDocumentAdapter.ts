
import { IDocumentGenerator, Document, DocumentRequest } from '../../ports';

export class MemoryDocumentAdapter implements IDocumentGenerator {
  private documents: Map<string, Document> = new Map();

  async generateDocument(request: DocumentRequest): Promise<Document> {
    const id = crypto.randomUUID();
    const verificationCode = crypto.randomUUID().split('-')[0];
    const document: Document = {
      id,
      type: request.type,
      userId: request.userId,
      status: 'ready',
      verificationCode,
      createdAt: new Date(),
      url: `https://example.com/documents/${id}`,
    };
    this.documents.set(id, document);
    return document;
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.documents.get(id) || null;
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(d => d.userId === userId);
  }

  async verifyDocument(verificationCode: string): Promise<Document | null> {
    for (const doc of this.documents.values()) {
      if (doc.verificationCode === verificationCode) {
        return doc;
      }
    }
    return null;
  }
}
