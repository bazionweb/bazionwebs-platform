import type { IWriteQueue, IHealthCheck } from '../../ports';

export class CloudflareWriteQueueAdapter implements IWriteQueue, IHealthCheck {
  constructor(private readonly writeQueueDO: DurableObjectNamespace) {}

  async enqueue<T = any>(operation: T, shardKey: string): Promise<void> {
    const id = this.writeQueueDO.idFromName(shardKey);
    const obj = this.writeQueueDO.get(id);

    const req = new Request('http://do/enqueue', {
      method: 'POST',
      body: JSON.stringify(operation)
    });

    const res = await obj.fetch(req);
    if (!res.ok) {
      throw new Error(`WriteQueue DO returned ${res.status}`);
    }
  }

  async health(): Promise<boolean> {
    return true;
  }
}
