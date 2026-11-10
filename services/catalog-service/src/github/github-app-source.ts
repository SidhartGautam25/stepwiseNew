import * as zlib from 'node:zlib';
import type { ContentSource } from '@app/content-core';
import { parseTarBuffer } from '@app/content-core';
import { GitHubAuthService } from './github-auth.service.js';

export class GitHubAppSource implements ContentSource {
  constructor(
    private readonly repoFullName: string,
    private readonly installationId: string,
    private readonly authService: GitHubAuthService,
  ) {}

  async listBranchTips(): Promise<Map<string, string>> {
    const token = await this.authService.getInstallationToken(this.installationId);
    const url = `https://api.github.com/repos/${this.repoFullName}/git/matching-refs/heads/`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'handrail-catalog-service',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list GitHub branch tips for ${this.repoFullName} (${res.status}): ${err}`);
    }

    const refs = (await res.json()) as Array<{
      ref: string;
      object: { sha: string; type: string };
    }>;

    const tips = new Map<string, string>();
    for (const item of refs) {
      if (item.ref.startsWith('refs/heads/')) {
        const branchName = item.ref.replace('refs/heads/', '');
        tips.set(branchName, item.object.sha);
      }
    }

    return tips;
  }

  async readTree(commitSha: string): Promise<Map<string, Buffer>> {
    const token = await this.authService.getInstallationToken(this.installationId);
    const url = `https://api.github.com/repos/${this.repoFullName}/tarball/${commitSha}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'handrail-catalog-service',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to download tarball for ${this.repoFullName}@${commitSha} (${res.status}): ${err}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const gzippedBuf = Buffer.from(arrayBuffer);
    const tarBuf = zlib.gunzipSync(gzippedBuf);

    // Parse tar entries
    const rawEntries = parseTarBuffer(tarBuf);
    const cleanedEntries = new Map<string, Buffer>();

    for (const [rawPath, content] of rawEntries.entries()) {
      // GitHub tarballs prefix files with '<owner>-<repo>-<shortSha>/'
      const parts = rawPath.split('/').filter(Boolean);
      if (parts.length <= 1) continue; // skip the root directory itself

      // Security: Prevent path traversal
      if (parts.some((p) => p === '..' || p === '.')) {
        throw new Error(`Path traversal detected in archive entry: ${rawPath}`);
      }

      // Remove the top-level repo-commit folder
      const normalizedPath = parts.slice(1).join('/');
      cleanedEntries.set(normalizedPath, content);
    }

    return cleanedEntries;
  }
}
