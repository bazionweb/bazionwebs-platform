export interface IHealthCheck {
  /**
   * Checks the health of the underlying resource.
   * Returns true if healthy, false or throws if unhealthy.
   */
  health(): Promise<boolean>;
}
