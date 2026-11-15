
export type DocumentType = 'transcript' | 'certificate' | 'enrollment_letter' | 'good_standing' | 'admission_letter' | 'id_card';

export interface Document {
  id: string;
  type: DocumentType;
  userId: string;
  status: 'generating' | 'ready' | 'failed';
  url?: string;
  data?: Buffer;
  createdAt: Date;
  expiresAt?: Date;
  verificationCode?: string;
}

export interface DocumentRequest {
  type: DocumentType;
  userId: string;
  metadata?: Record<string, any>;
}

export interface IDocumentGenerator {
  generateDocument(request: DocumentRequest): Promise<Document>;
  getDocument(id: string): Promise<Document | null>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  verifyDocument(verificationCode: string): Promise<Document | null>;
}
