import { Injectable, Logger } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ContentSource } from '@app/content-core';
import { LocalGitSource } from '@app/content-core';
import { CatalogConfigService } from '../config/catalog.config.js';
import { GitHubAuthService } from '../github/github-auth.service.js';
import { GitHubAppSource } from '../github/github-app-source.js';

@Injectable()
export class ContentSourceFactory {
  private readonly logger = new Logger(ContentSourceFactory.name);

  constructor(
    private readonly config: CatalogConfigService,
    private readonly gitHubAuth: GitHubAuthService,
  ) {}

  create(repoFullName: string, installationId?: string | null): ContentSource {
    const mode = this.config.contentSource;

    if (mode === 'local') {
      // Find local git repo
      // 1. Check if repoFullName is a direct valid path
      if (fs.existsSync(repoFullName) && (fs.existsSync(path.join(repoFullName, '.git')) || fs.existsSync(path.join(repoFullName, 'HEAD')))) {
        return new LocalGitSource(repoFullName);
      }

      // Find workspace root by walking up for pnpm-workspace.yaml
      let workspaceRoot = process.cwd();
      let curr = workspaceRoot;
      while (curr !== path.dirname(curr)) {
        if (fs.existsSync(path.join(curr, 'pnpm-workspace.yaml'))) {
          workspaceRoot = curr;
          break;
        }
        curr = path.dirname(curr);
      }

      // 2. Check under CONTENT_LOCAL_REPOS and workspace root
      const configuredBase = path.isAbsolute(this.config.contentLocalRepos)
        ? this.config.contentLocalRepos
        : path.resolve(workspaceRoot, this.config.contentLocalRepos);

      const repoBaseName = path.basename(repoFullName);
      const candidatePaths = [
        path.join(configuredBase, repoFullName),
        path.join(configuredBase, repoBaseName),
        path.join(configuredBase, `${repoBaseName}.git`),
        path.resolve(workspaceRoot, 'content', repoBaseName),
        path.resolve(workspaceRoot, repoFullName),
        path.resolve(process.cwd(), repoFullName),
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p) && (fs.existsSync(path.join(p, '.git')) || fs.existsSync(path.join(p, 'HEAD')))) {
          return new LocalGitSource(p);
        }
      }

      // If none found with .git, but folder exists, throw informative error
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          return new LocalGitSource(p);
        }
      }

      throw new Error(
        `Local git repository not found for "${repoFullName}". Checked locations: ${candidatePaths.join(', ')}`,
      );
    }

    if (mode === 'github') {
      if (!installationId) {
        throw new Error(
          `Cannot create GitHubAppSource for ${repoFullName}: missing GitHub installation ID`,
        );
      }
      return new GitHubAppSource(repoFullName, installationId, this.gitHubAuth);
    }

    throw new Error(`Unsupported CONTENT_SOURCE mode: ${mode}`);
  }
}
