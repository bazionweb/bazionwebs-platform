import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock security module
vi.mock('../services/security', () => ({
  generate2FASecret: vi.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  get2FAQRCodeURL: vi.fn().mockReturnValue('https://api.qrserver.com/v1/create-qr-code/?data=otpauth://totp/...'),
  verifyTOTP: vi.fn().mockResolvedValue(true),
  store2FASecret: vi.fn().mockResolvedValue(undefined),
  enable2FA: vi.fn().mockResolvedValue(true),
  disable2FA: vi.fn().mockResolvedValue(undefined),
  is2FAEnabled: vi.fn().mockResolvedValue(false),
  get2FASecret: vi.fn().mockResolvedValue('JBSWY3DPEHPK3PXP'),
}));

describe('TwoFactorSetup', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@church.com',
    username: 'testuser',
    role: 'Admin' as const,
    permissionLevel: 'Editor' as const,
    passwordHash: 'hash',
    avatar: '',
    lastLogin: '',
  };

  const defaultProps = {
    user: mockUser,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the modal with header', async () => {
    const { default: TwoFactorSetup } = await import('./TwoFactorSetup');

    render(<TwoFactorSetup {...defaultProps} />);

    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByText('Secure your account with 2FA')).toBeInTheDocument();
  });

  it('should show enable button when 2FA is disabled', async () => {
    const { default: TwoFactorSetup } = await import('./TwoFactorSetup');

    render(<TwoFactorSetup {...defaultProps} />);

    const enableBtn = await screen.findByText('Enable 2FA');
    expect(enableBtn).toBeInTheDocument();
  });

  it('should show disable button when 2FA is enabled', async () => {
    const security = await import('../services/security');
    (security.is2FAEnabled as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const { default: TwoFactorSetup } = await import('./TwoFactorSetup');

    render(<TwoFactorSetup {...defaultProps} />);

    const disableBtn = await screen.findByText('Disable 2FA');
    expect(disableBtn).toBeInTheDocument();
  });

  it('should have a close button', async () => {
    const { default: TwoFactorSetup } = await import('./TwoFactorSetup');

    render(<TwoFactorSetup {...defaultProps} />);

    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});
