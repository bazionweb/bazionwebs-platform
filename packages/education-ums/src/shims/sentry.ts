export function init(_config?: Record<string, unknown>) {}
export function browserTracingIntegration() {
  return {};
}
export function replayIntegration() {
  return {};
}
export function captureException(_err: unknown) {}
export function captureMessage(_msg: string) {}
export function setUser(_user: Record<string, unknown> | null) {}

