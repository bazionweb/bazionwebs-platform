import type { IQueue, IQueueConsumer, IHealthCheck } from '../../ports';

export class InMemoryQueueAdapter implements IQueue, IHealthCheck {
  public messages: any[] = [];
  private consumer?: IQueueConsumer;

  async send<T = any>(message: T, options?: { delaySeconds?: number }): Promise<string> {
    const id = crypto.randomUUID();
    
    const deliver = async () => {
      this.messages.push({ id, message });
      if (this.consumer) {
        try {
          await this.consumer.process(message);
        } catch (err) {
          await this.consumer.onError(err as Error, message);
        }
      }
    };

    if (options?.delaySeconds) {
      setTimeout(deliver, options.delaySeconds * 1000);
    } else {
      // Deliver asynchronously
      setTimeout(deliver, 0);
    }

    return id;
  }

  async sendBatch<T = any>(messages: T[]): Promise<string[]> {
    const ids: string[] = [];
    for (const msg of messages) {
      ids.push(await this.send(msg));
    }
    return ids;
  }

  setConsumer(consumer: IQueueConsumer) {
    this.consumer = consumer;
  }

  async health(): Promise<boolean> {
    return true;
  }
}
