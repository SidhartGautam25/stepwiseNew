import { Injectable, NotFoundException, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StarterRepository } from './starter.repository.js';
import { createZipArchive, type ZipEntry } from './zip.util.js';
import type { StarterInfoResponseDto, StarterInstructionsDto } from '@app/contracts';

@Injectable()
export class StarterService {
  private readonly logger = new Logger(StarterService.name);
  private readonly secretKey =
    process.env.SUPABASE_JWT_SECRET ||
    process.env.STARTER_SECRET_KEY ||
    'handrail-starter-download-hmac-secret-key-32-chars';

  // In-memory archive cache: `${slug}:${language}` -> { buffer, checksum, fileSize, updatedAt }
  private readonly archiveCache = new Map<
    string,
    { buffer: Buffer; checksum: string; fileSize: number; updatedAt: number }
  >();

  constructor(
    @Inject(StarterRepository)
    private readonly starterRepo: StarterRepository,
  ) {}

  /**
   * Generates a tamper-proof HMAC-SHA256 signature for download URLs
   */
  generateSignature(workshopSlug: string, language: string, expires: number): string {
    const payload = `${workshopSlug}:${language}:${expires}`;
    return crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
  }

  /**
   * Verifies an incoming download URL signature
   */
  verifySignature(workshopSlug: string, language: string, expires: number, signature: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (expires < now) {
      return false; // Expired
    }
    const expected = this.generateSignature(workshopSlug, language, expires);
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }

  /**
   * Recursively reads a directory and collects ZipEntry items
   */
  private readDirectoryRecursive(dir: string, baseDir: string = dir): ZipEntry[] {
    const entries: ZipEntry[] = [];
    if (!fs.existsSync(dir)) return entries;

    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        entries.push(...this.readDirectoryRecursive(fullPath, baseDir));
      } else {
        const relativePath = path.relative(baseDir, fullPath);
        const data = fs.readFileSync(fullPath);
        entries.push({ name: relativePath, data });
      }
    }
    return entries;
  }

  /**
   * Builds the starter ZIP archive for a workshop and language
   */
  async buildArchive(workshopSlug: string, language: string): Promise<{ buffer: Buffer; checksum: string; fileSize: number }> {
    const cacheKey = `${workshopSlug}:${language}`;
    const cached = this.archiveCache.get(cacheKey);
    // Cache for 60 seconds during development
    if (cached && Date.now() - cached.updatedAt < 60000) {
      return cached;
    }

    let contentBase = path.resolve(process.cwd(), 'content');
    if (!fs.existsSync(contentBase)) {
      let cur = process.cwd();
      for (let i = 0; i < 4; i++) {
        const candidate = path.join(cur, 'content');
        if (fs.existsSync(candidate)) {
          contentBase = candidate;
          break;
        }
        cur = path.dirname(cur);
      }
    }
    const starterDir = path.resolve(contentBase, workshopSlug, 'starters', language);
    if (!fs.existsSync(starterDir)) {
      throw new NotFoundException(
        `Starter template for workshop "${workshopSlug}" and language "${language}" not found under ${starterDir}`,
      );
    }

    const zipEntries = this.readDirectoryRecursive(starterDir);

    // If .gitignore is not present, add an appropriate default
    const hasGitignore = zipEntries.some((e) => e.name === '.gitignore');
    if (!hasGitignore) {
      const defaultGitignore = [
        '# Dependencies',
        'node_modules/',
        'vendor/',
        '__pycache__/',
        '*.pyc',
        '',
        '# Compiled binaries',
        'bin/',
        '*.exe',
        '*.dll',
        '*.so',
        '*.dylib',
        '',
        '# Environment & IDE',
        '.env',
        '.DS_Store',
        '.idea/',
        '.vscode/',
      ].join('\n');
      zipEntries.push({ name: '.gitignore', data: Buffer.from(defaultGitignore, 'utf8') });
    }

    // If README.md is not present, add a clear setup README
    const hasReadme = zipEntries.some((e) => e.name.toLowerCase() === 'readme.md');
    if (!hasReadme) {
      const readme = [
        `# Handrail Starter: ${workshopSlug} (${language})`,
        '',
        '> This repository is your local workspace for Handrail. Develop locally in your favorite editor, push to GitHub, and receive real-time verification feedback.',
        '',
        '## 🚀 Getting Started',
        '',
        '```bash',
        '# 1. Initialize local git repository',
        'git init',
        '',
        '# 2. Stage all starter files',
        'git add .',
        '',
        '# 3. Create your initial commit',
        'git commit -m "initial handrail starter commit"',
        '',
        '# 4. Set branch name to main',
        'git branch -M main',
        '',
        '# 5. Link your GitHub repository',
        'git remote add origin https://github.com/<your-username>/<your-repo-name>.git',
        '',
        '# 6. Push to trigger automated Handrail verification',
        'git push -u origin main',
        '```',
        '',
        '## 🛠️ Verification Workflow',
        'The included `.github/workflows/verify.yml` triggers automatically whenever you push to `main` or `master`.',
        'Results stream live to the Handrail learning interface.',
      ].join('\n');
      zipEntries.push({ name: 'README.md', data: Buffer.from(readme, 'utf8') });
    }

    const buffer = createZipArchive(zipEntries);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileSize = buffer.length;

    const result = { buffer, checksum, fileSize, updatedAt: Date.now() };
    this.archiveCache.set(cacheKey, result);

    // Save or update in database via repository if starter schema is accessible
    try {
      await this.starterRepo.upsertStarterTemplate({
        workshopSlug,
        language,
        version: '1.0.0',
        checksum,
        fileSize,
        s3Key: `starters/${workshopSlug}/${language}/starter.zip`,
      });
    } catch (err: any) {
      this.logger.debug(`Database record for starter template skipped: ${err.message}`);
    }

    return result;
  }

  /**
   * Returns starter metadata, instructions, and signed download URL
   */
  async getStarterInfo(
    workshopSlug: string,
    language: string,
    gatewayUrl?: string,
  ): Promise<StarterInfoResponseDto> {
    const { checksum, fileSize } = await this.buildArchive(workshopSlug, language);

    // Generate signed download URL (valid for 2 hours)
    const expires = Math.floor(Date.now() / 1000) + 7200;
    const signature = this.generateSignature(workshopSlug, language, expires);

    const baseUrl = gatewayUrl || process.env.API_GATEWAY_URL || 'http://localhost:4000';
    const downloadUrl = `${baseUrl}/v1/starters/${workshopSlug}/${language}/download?sig=${signature}&expires=${expires}`;

    const instructions: StarterInstructionsDto = {
      gitInit: 'git init',
      gitAdd: 'git add .',
      gitCommit: 'git commit -m "initial starter commit"',
      gitBranch: 'git branch -M main',
      gitRemote: 'git remote add origin https://github.com/<your-username>/<repo-name>.git',
      gitPush: 'git push -u origin main',
    };

    return {
      workshopSlug,
      language,
      version: '1.0.0',
      checksum,
      fileSize,
      downloadUrl,
      instructions,
    };
  }

  /**
   * Verifies signed request and delivers the zip buffer
   */
  async getDownloadBuffer(
    workshopSlug: string,
    language: string,
    sig?: string,
    expires?: string,
  ): Promise<Buffer> {
    if (sig && expires) {
      const expNum = parseInt(expires, 10);
      const isValid = this.verifySignature(workshopSlug, language, expNum, sig);
      if (!isValid) {
        throw new UnauthorizedException('Download signature has expired or is invalid');
      }
    }

    const { buffer } = await this.buildArchive(workshopSlug, language);
    return buffer;
  }
}

