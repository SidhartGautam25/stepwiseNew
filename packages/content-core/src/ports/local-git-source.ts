import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import type { ContentSource } from './content-source.js';

const execFileAsync = promisify(execFile);

/**
 * Parses an uncompressed POSIX tar buffer in memory into a path -> Buffer map
 */
export function parseTarBuffer(tarBuf: Buffer): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  let offset = 0;

  while (offset + 512 <= tarBuf.length) {
    const header = tarBuf.subarray(offset, offset + 512);

    // If block is all zeros, it might be the end of archive
    let isAllZero = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        isAllZero = false;
        break;
      }
    }
    if (isAllZero) {
      break;
    }

    // Extract name (bytes 0-100)
    let nullIdx = header.indexOf(0, 0);
    if (nullIdx === -1 || nullIdx > 100) nullIdx = 100;
    const name = header.toString('utf-8', 0, nullIdx).trim();

    // Prefix for ustar (bytes 345-500)
    let prefix = '';
    const magic = header.toString('ascii', 257, 262);
    if (magic === 'ustar') {
      let pNullIdx = header.indexOf(0, 345);
      if (pNullIdx === -1 || pNullIdx > 500) pNullIdx = 500;
      prefix = header.toString('utf-8', 345, pNullIdx).trim();
    }

    const fullPath = prefix ? `${prefix}/${name}` : name;

    // Extract size (bytes 124-136, octal)
    const sizeStr = header.toString('ascii', 124, 136).replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;

    // Typeflag (byte 156)
    const typeflag = String.fromCharCode(header[156]);

    offset += 512;

    if (typeflag === '0' || typeflag === '\0') {
      // Regular file
      const content = tarBuf.subarray(offset, offset + size);
      const normalizedPath = fullPath.replace(/\\/g, '/').replace(/^\/+/, '');
      result.set(normalizedPath, Buffer.from(content));
    }

    // Advance to next 512-byte boundary
    const remainder = size % 512;
    const pad = remainder === 0 ? 0 : 512 - remainder;
    offset += size + pad;
  }

  return result;
}

export class LocalGitSource implements ContentSource {
  constructor(private readonly repoPath: string) {
    if (!fs.existsSync(repoPath)) {
      throw new Error(`LocalGitSource repository path does not exist: ${repoPath}`);
    }
  }

  /**
   * Lists branch tips using git plumbing: git for-each-ref
   */
  async listBranchTips(): Promise<Map<string, string>> {
    const { stdout } = await execFileAsync(
      'git',
      ['for-each-ref', '--format=%(refname:short)|%(objectname)', 'refs/heads', 'refs/remotes/origin'],
      { cwd: this.repoPath, maxBuffer: 10 * 1024 * 1024 },
    );

    const tips = new Map<string, string>();
    const lines = stdout.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [ref, sha] = trimmed.split('|');
      if (ref && sha) {
        // Normalize origin/chapter/... to chapter/...
        const branchName = ref.startsWith('origin/') ? ref.replace(/^origin\//, '') : ref;
        if (!tips.has(branchName)) {
          tips.set(branchName, sha.trim());
        }
      }
    }

    return tips;
  }

  /**
   * Reads tree at commit SHA using git archive without touching the working directory
   */
  async readTree(commitSha: string): Promise<Map<string, Buffer>> {
    const { stdout } = await execFileAsync(
      'git',
      ['archive', '--format=tar', commitSha],
      {
        cwd: this.repoPath,
        encoding: 'buffer',
        maxBuffer: 50 * 1024 * 1024,
      },
    );

    return parseTarBuffer(stdout);
  }
}
