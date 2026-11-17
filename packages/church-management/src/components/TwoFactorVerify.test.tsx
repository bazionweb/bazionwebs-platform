import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../services/security', () => ({
  verifyTOTP: vi.fn().mockResolvedValue(true),
  get2FASecret: vi.fn().mockResolvedValue('JBSWY3DPEHPK3PXP'),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditActions: { TWO_FA_VERIFIED: 'TWO_FA_VERIFIED' },
}));

describe('TwoFactorVerify', () => {
  const defaultProps = {
    userId: 'user-123',
    userEmail: 'test@church.com',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render verification UI', async () => {
    const { default: TwoFactorVerify } = await import('./TwoFactorVerify');

    render(<TwoFactorVerify {...defaultProps} />);

    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByText('Enter the code from your authenticator app')).toBeInTheDocument();
  });

  it('should render code input field', async () => {
    const { default: TwoFactorVerify } = await import('./TwoFactorVerify');

    render(<TwoFactorVerify {...defaultProps} />);

    const input = screen.getByPlaceholderText('000000');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('maxLength', '6');
  });

  it('should render verify and cancel buttons', async () => {
    const { default: TwoFactorVerify } = await import('./TwoFactorVerify');

    render(<TwoFactorVerify {...defaultProps} />);

    expect(screen.getByText('Verify')).toBeInTheDocument();
    expect(screen.getByText('Cancel and go back')).toBeInTheDocument();
  });

  it('should call onCancel when cancel is clicked', async () => {
    const { default: TwoFactorVerify } = await import('./TwoFactorVerify');
    const user = userEvent.setup();

    render(<TwoFactorVerify {...defaultProps} />);

    await user.click(screen.getByText('Cancel and go back'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
