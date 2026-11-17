export interface IWriteQueue {
  /**
   * Enqueues an operation to be written serially.
   */
  enqueue<T = any>(operation: T, shardKey: string): Promise<void>;
}
