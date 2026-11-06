import { describe, it, expect } from 'vitest';
import { createZipArchive, crc32 } from './zip.util.js';

describe('Zip Utility', () => {
  it('computes correct crc32 for known string', () => {
    const data = Buffer.from('123456789', 'ascii');
    // Standard CRC-32 for "123456789" is 0xcbf43926 (3421780262)
    expect(crc32(data)).toBe(0xcbf43926);
  });

  it('creates valid zip buffer containing files and directory paths', () => {
    const files = [
      { name: 'README.md', data: Buffer.from('# Starter Template\nHello Handrail!') },
      { name: 'app/main.go', data: Buffer.from('package main\n\nfunc main() {}\n') },
      { name: '.github/workflows/verify.yml', data: Buffer.from('name: Verify\n') },
    ];

    const zipBuffer = createZipArchive(files);
    expect(zipBuffer).toBeInstanceOf(Buffer);
    expect(zipBuffer.length).toBeGreaterThan(100);

    // Starts with PK zip header 0x04034b50 (PK\x03\x04)
    expect(zipBuffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    // Ends with End of Central Directory signature 0x06054b50 (PK\x05\x06)
    const eocdIndex = zipBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdIndex).toBeGreaterThan(0);
  });
});

