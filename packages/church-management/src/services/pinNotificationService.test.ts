import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendPinNotification } from './pinNotificationService';

describe('pinNotificationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(
        JSON.stringify({
          smsConfig: {
            apiKey: 'test-sms-key',
            senderId: 'TEST',
            textbeeApiKey: 'test-textbee-key',
            textbeeDeviceId: 'textbee-device-123',
          },
          emailConfig: { resendApiKey: 'test-email-key', resendFromEmail: 'test@hkm.org', portalUrl: 'http://test' },
        }),
      ),
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on 500 error for Resend', async () => {
    let attempts = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('api.resend.com') || url.includes('resend-proxy')) {
          attempts++;
          if (attempts < 3) {
            return { ok: false, status: 500, json: async () => ({ message: 'Server error' }) };
          }
          return { ok: true, status: 200, json: async () => ({ id: 'resend-id-123' }) };
        }

        if (url.includes('api/sms/send') || url.includes('sms-backend')) {
          return { ok: true, status: 200, json: async () => ({ status: 'queued' }) };
        }

        if (url.includes('arkesel.com')) {
          return { ok: true, status: 200, json: async () => ({ status: 'success' }) };
        }

        return { ok: false, status: 404 };
      }),
    );

    const promise = sendPinNotification({
      memberId: 'M-123',
      memberName: 'John',
      email: 'john@test.com',
      phone: '+254700000000',
      pin: '123456',
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(attempts).toBe(3);
    expect(result.email.sent).toBe(true);
    expect(result.sms.sent).toBe(true);
  });

  it('includes org_email in Resend API request body', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let requestBody: any = null;

    vi.stubGlobal(
      'fetch',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.fn().mockImplementation(async (url: string, options?: any) => {
        if (url.includes('api.resend.com') || url.includes('resend-proxy')) {
          requestBody = JSON.parse(options.body);
          return { ok: true, status: 200, json: async () => ({ id: 'resend-id-456' }) };
        }
        if (url.includes('api/sms/send') || url.includes('sms-backend')) {
          return { ok: true, status: 200, json: async () => ({ status: 'queued' }) };
        }
        return { ok: false, status: 404 };
      }),
    );

    const promise = sendPinNotification({
      memberId: 'M-456',
      memberName: 'Jane',
      email: 'jane@personal.com',
      phone: '+254711111111',
      pin: '654321',
      orgEmail: 'jane.doe@hkmministries.org',
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.email.sent).toBe(true);
    expect(requestBody).not.toBeNull();
    expect(requestBody.html).toContain('jane.doe@hkmministries.org');
    expect(requestBody.html).toContain('Your Church Email Address');
  });

  it('does not include org_email section when orgEmail is empty', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let requestBody: any = null;

    vi.stubGlobal(
      'fetch',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.fn().mockImplementation(async (url: string, options?: any) => {
        if (url.includes('api.resend.com') || url.includes('resend-proxy')) {
          requestBody = JSON.parse(options.body);
          return { ok: true, status: 200, json: async () => ({ id: 'resend-id-789' }) };
        }
        if (url.includes('api/sms/send') || url.includes('sms-backend')) {
          return { ok: true, status: 200, json: async () => ({ status: 'queued' }) };
        }
        return { ok: false, status: 404 };
      }),
    );

    const promise = sendPinNotification({
      memberId: 'M-789',
      memberName: 'Peter',
      email: 'peter@test.com',
      phone: '+254722222222',
      pin: '111222',
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.email.sent).toBe(true);
    expect(requestBody).not.toBeNull();
    expect(requestBody.html).not.toContain('Your Church Email Address');
  });
});
