import type { ILogger } from '../../ports';

export class CloudflareLoggerAdapter implements ILogger {
  constructor(private readonly requestId?: string) {}

  private redact(obj: any): any {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;
    
    // Simple redaction (would normally use the shared middleware redactor)
    const redacted = { ...obj };
    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'credit_card'];
    
    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = this.redact(redacted[key]);
      }
    }
    return redacted;
  }

  private format(msg: string, meta?: any) {
    const output = {
      msg,
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      ...(meta ? { meta: this.redact(meta) } : {})
    };
    return JSON.stringify(output);
  }

  info(msg: string, meta?: any): void {
    console.log(this.format(msg, meta));
  }

  error(msg: string, meta?: any): void {
    console.error(this.format(msg, meta));
  }

  warn(msg: string, meta?: any): void {
    console.warn(this.format(msg, meta));
  }

  debug(msg: string, meta?: any): void {
    console.debug(this.format(msg, meta));
  }
}
