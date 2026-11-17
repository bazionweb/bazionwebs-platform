import type { IWriteQueue, IHealthCheck } from '../../ports';

export class MemoryWriteQueueAdapter implements IWriteQueue, IHealthCheck {
  public queues = new Map<string, any[]>();
  private processing = new Set<string>();

  async enqueue<T = any>(operation: T, shardKey: string): Promise<void> {
    if (!this.queues.has(shardKey)) {
      this.queues.set(shardKey, []);
    }
    this.queues.get(shardKey)!.push(operation);
    this.processQueue(shardKey);
  }

  private async processQueue(shardKey: string) {
    if (this.processing.has(shardKey)) return;
    this.processing.add(shardKey);

    try {
      const queue = this.queues.get(shardKey);
      while (queue && queue.length > 0) {
        queue.shift(); // dequeue — processing is mocked below
        // Mock processing the operation (in a real scenario, this would call a handler)
        // console.log(`Processing op for ${shardKey}:`, op);
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
      }
    } finally {
      this.processing.delete(shardKey);
    }
  }

  async health(): Promise<boolean> {
    return true;
  }
}
