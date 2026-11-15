export interface ITracer {
  getRequestId(): string;
  setRequestId(id: string): void;
  attachToLogs(meta: any): any;
}
