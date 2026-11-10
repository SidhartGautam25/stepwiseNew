import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { buildDeterministicZip } from '../packaging/deterministic-zip.js';
import { buildDeterministicTarGz } from '../packaging/deterministic-tar.js';

describe('Deterministic Packaging', () => {
  const sha256 = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');

  it('produces identical byte-for-byte ZIP archives regardless of input order', () => {
    const fileA = { path: 'src/main.go', content: 'package main\nfunc main() {}\n' };
    const fileB = { path: 'go.mod', content: 'module example.com/app\ngo 1.22\n' };
    const fileC = { path: 'handrail.yaml', content: 'build: ["go", "build"]\nrun: { default: ["./app"] }\n' };

    const zip1 = buildDeterministicZip([fileA, fileB, fileC]);
    const zip2 = buildDeterministicZip([fileC, fileA, fileB]);

    expect(zip1.length).toBeGreaterThan(0);
    expect(zip1.equals(zip2)).toBe(true);
    expect(sha256(zip1)).toBe(sha256(zip2));
  });

  it('produces identical byte-for-byte TAR.GZ archives regardless of input order', () => {
    const test1 = { path: 'handrail/tests/test-1/test.yaml', content: 'id: test-1\ndescription: Test 1\n' };
    const test2 = { path: 'handrail/tests/test-2/test.yaml', content: 'id: test-2\ndescription: Test 2\n' };
    const manifest = { path: 'manifest.json', content: '{"steps":[]}' };

    const tar1 = buildDeterministicTarGz([test1, test2, manifest]);
    const tar2 = buildDeterministicTarGz([manifest, test2, test1]);

    expect(tar1.length).toBeGreaterThan(0);
    expect(tar1.equals(tar2)).toBe(true);
    expect(sha256(tar1)).toBe(sha256(tar2));
  });

  it('rejects path traversal attempts in archive entries', () => {
    const malicious = [{ path: '../secret.txt', content: 'evil' }];
    expect(() => buildDeterministicZip(malicious)).toThrow(/Path traversal/);
    expect(() => buildDeterministicTarGz(malicious)).toThrow(/Path traversal/);
  });
});
