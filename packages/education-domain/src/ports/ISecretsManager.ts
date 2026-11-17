export interface ISecretsManager {
  /**
   * Retrieves a secret string by key.
   */
  get(key: string): Promise<string | null>;

  /**
   * Retrieves and parses a JSON secret by key.
   */
  getSecret<T = any>(key: string): Promise<T | null>;
}
