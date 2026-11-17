export interface IQueue {
  /**
   * Sends a single message to the queue.
   * Returns a unique message identifier.
   */
  send<T = any>(message: T, options?: { delaySeconds?: number }): Promise<string>;

  /**
   * Sends a batch of messages to the queue.
   * Returns an array of message identifiers.
   */
  sendBatch<T = any>(messages: T[]): Promise<string[]>;
}

export interface IQueueConsumer<T = any> {
  /**
   * Processes a single message from the queue.
   */
  process(message: T): Promise<void>;

  /**
   * Handles errors that occur during processing.
   */
  onError(error: Error, message: T): Promise<void>;
}
