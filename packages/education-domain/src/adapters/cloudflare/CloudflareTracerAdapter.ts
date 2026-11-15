import type { ITracer } from '../../ports';

export class CloudflareTracerAdapter implements ITracer {
  private requestId: string;

  constructor(existingRequestId?: string) {
    this.requestId = existingRequestId || crypto.randomUUID();
  }

  getRequestId(): string {
    return this.requestId;
  }

  setRequestId(id: string): void {
    this.requestId = id;
  }

  attachToLogs(meta: any): any {
    return {
      ...meta,
      requestId: this.requestId
    };
  }
}
