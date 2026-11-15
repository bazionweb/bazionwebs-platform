import type { IQueue, IHealthCheck } from '../../ports';

export class CloudflareQueueAdapter implements IQueue, IHealthCheck {
  constructor(private readonly queue: Queue<any>) {}

  async send<T = any>(message: T, options?: { delaySeconds?: number }): Promise<string> {
    const queueOptions: QueueSendOptions = {};
    if (options?.delaySeconds) {
      queueOptions.delaySeconds = options.delaySeconds;
    }
    // Cloudflare Queues don't natively return a message ID from send(), so we return a placeholder or generate one
    await this.queue.send(message, queueOptions);
    return crypto.randomUUID();
  }

  async sendBatch<T = any>(messages: T[]): Promise<string[]> {
    const messagesToSend = messages.map(body => ({ body }));
    await this.queue.sendBatch(messagesToSend);
    return messages.map(() => crypto.randomUUID());
  }

  async health(): Promise<boolean> {
    return true; // Queues don't have a direct health check via bindings
  }
}
