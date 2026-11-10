import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HttpAccessPolicyAdapter } from './http-access-policy.adapter.js';
import { InMemoryAccessPolicyFake } from './in-memory-access-policy.fake.js';
import { CachedAccessPolicyService } from './cached-access-policy.service.js';

describe('Access Policy Gating & Caching', () => {
  describe('HttpAccessPolicyAdapter', () => {
    let adapter: HttpAccessPolicyAdapter;
    let mockConfig: any;

    beforeEach(() => {
      mockConfig = {
        profileServiceUrl: 'http://localhost:4004',
        serviceSecret: 'test-secret',
      };
      adapter = new HttpAccessPolicyAdapter(mockConfig);
    });

    it('returns enrolled and unlocked chapters on 200 OK from profile service', async () => {
      const mockResponse = {
        enrolled: true,
        versionId: 'ver-123',
        unlockedChapters: ['01-ping', '02-pong'],
        currentChapterId: '02-pong',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as any);

      const res = await adapter.checkAccess('user-1', 'http-server');
      expect(res.enrolled).toBe(true);
      expect(res.versionId).toBe('ver-123');
      expect(res.unlockedChapters).toEqual(['01-ping', '02-pong']);
    });

    it('returns unenrolled on 404 Not Found from profile service', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      const res = await adapter.checkAccess('user-not-enrolled', 'http-server');
      expect(res.enrolled).toBe(false);
      expect(res.unlockedChapters).toEqual([]);
    });

    it('FAILS CLOSED: throws 503 ServiceUnavailable on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(adapter.checkAccess('user-1', 'http-server')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('FAILS CLOSED: throws 503 ServiceUnavailable on 500 error from profile', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as any);

      await expect(adapter.checkAccess('user-1', 'http-server')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('CachedAccessPolicyService', () => {
    let cachedService: CachedAccessPolicyService;
    let fakePort: InMemoryAccessPolicyFake;
    let mockConfig: any;

    beforeEach(() => {
      fakePort = new InMemoryAccessPolicyFake();
      mockConfig = {
        redisUrl: 'redis://localhost:6379',
      };
      cachedService = new CachedAccessPolicyService(fakePort, mockConfig);
    });

    it('delegates to underlying port and caches result', async () => {
      fakePort.setAccess('u1', 'w1', {
        enrolled: true,
        versionId: 'v1',
        unlockedChapters: ['c1'],
      });

      const res = await cachedService.checkAccess('u1', 'w1');
      expect(res.enrolled).toBe(true);
      expect(res.unlockedChapters).toContain('c1');
    });

    it('propagates fail-closed exception when profile has an outage', async () => {
      fakePort.setOutage(true);

      await expect(cachedService.checkAccess('u1', 'w1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
