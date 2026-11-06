import { describe, it, expect, beforeEach } from 'vitest';
import { StarterService } from './starter.service.js';

describe('StarterService', () => {
  let service: StarterService;

  beforeEach(() => {
    const mockPrisma = {
      starterTemplate: {
        upsert: async () => ({ id: 'mock-id' }),
      },
    } as any;
    service = new StarterService(mockPrisma);
  });

  it('builds valid zip archive for build-your-own-redis (go)', async () => {
    const { buffer, checksum, fileSize } = await service.buildArchive('build-your-own-redis', 'go');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(fileSize).toBeGreaterThan(0);
    expect(checksum).toHaveLength(64);
    // Standard PKZIP header
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('builds valid zip archive for build-your-own-react (typescript)', async () => {
    const { buffer, checksum } = await service.buildArchive('build-your-own-react', 'typescript');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(checksum).toHaveLength(64);
  });

  it('builds valid zip archive for build-your-own-git (go)', async () => {
    const { buffer, checksum } = await service.buildArchive('build-your-own-git', 'go');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(checksum).toHaveLength(64);
  });

  it('builds valid zip archive for build-your-own-npm (typescript)', async () => {
    const { buffer, checksum } = await service.buildArchive('build-your-own-npm', 'typescript');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(checksum).toHaveLength(64);
  });

  it('generates starter info with signed download URL and clear git instructions', async () => {
    const info = await service.getStarterInfo('build-your-own-redis', 'go', 'http://localhost:4000');
    expect(info.workshopSlug).toBe('build-your-own-redis');
    expect(info.language).toBe('go');
    expect(info.downloadUrl).toContain('http://localhost:4000/v1/starters/build-your-own-redis/go/download?sig=');
    expect(info.instructions.gitInit).toBe('git init');
    expect(info.instructions.gitPush).toBe('git push -u origin main');
  });

  it('validates HMAC signatures and prevents expired tokens', () => {
    const now = Math.floor(Date.now() / 1000);
    const validExpires = now + 3600;
    const sig = service.generateSignature('build-your-own-redis', 'go', validExpires);

    expect(service.verifySignature('build-your-own-redis', 'go', validExpires, sig)).toBe(true);
    expect(service.verifySignature('build-your-own-redis', 'python', validExpires, sig)).toBe(false);
    expect(service.verifySignature('build-your-own-redis', 'go', now - 10, sig)).toBe(false); // Expired
  });
});

