import { describe, it, expect, vi, beforeEach } from 'vitest';
import { admissionsService } from './admissionsService';
import { authFetch } from './authService';

vi.mock('./authService', () => ({
  authFetch: vi.fn(),
}));

vi.mock('./config', () => ({
  API_URL: 'http://localhost:8787/api/v1',
}));

describe('admissionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listApplications', () => {
    it('fetches all applications successfully', async () => {
      const mockData = [{ id: '1', status: 'submitted' }];
      vi.mocked(authFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      } as Response);

      const result = await admissionsService.listApplications();
      expect(result).toEqual(mockData);
      expect(authFetch).toHaveBeenCalledWith('http://localhost:8787/api/admin/applications');
    });

    it('appends query parameters when provided', async () => {
      const mockData = [{ id: '1', status: 'submitted' }];
      vi.mocked(authFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      } as Response);

      await admissionsService.listApplications({ status: 'submitted', limit: 10 });
      expect(authFetch).toHaveBeenCalledWith('http://localhost:8787/api/admin/applications?status=submitted&limit=10');
    });
  });

  describe('updateStatus', () => {
    it('updates application status successfully', async () => {
      vi.mocked(authFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await admissionsService.updateStatus('app1', 'accepted', 'Looks good');
      expect(result).toEqual({ success: true });
      expect(authFetch).toHaveBeenCalledWith('http://localhost:8787/api/admin/applications/app1/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted', notes: 'Looks good' }),
      });
    });

    it('throws error on failure', async () => {
      vi.mocked(authFetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid status' }),
        text: async () => JSON.stringify({ error: 'Invalid status' }),
      } as Response);

      await expect(admissionsService.updateStatus('app1', 'invalid')).rejects.toThrow('Invalid status');
    });
  });
});
