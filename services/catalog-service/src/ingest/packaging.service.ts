import { Injectable, Logger } from '@nestjs/common';
import type { ArchiveEntry, ParsedChapter } from '@app/content-core';
import { buildDeterministicZip, buildDeterministicTar } from '@app/content-core';

@Injectable()
export class PackagingService {
  private readonly logger = new Logger(PackagingService.name);

  /**
   * Builds deterministic starter zip for a given language from main branch tree.
   * STRICT HARD CONSTRAINT:
   * Only files under starters/<lang>/ are included.
   * Tests, solutions, and chapter contents MUST NEVER be present.
   */
  packageStarter(mainTree: Map<string, Buffer>, language: string): Buffer {
    const starterPrefix = `starters/${language}/`;
    const entries: ArchiveEntry[] = [];

    for (const [filePath, buffer] of mainTree.entries()) {
      if (!filePath.startsWith(starterPrefix)) {
        continue;
      }

      const relativePath = filePath.substring(starterPrefix.length);

      // Exclude empty paths, git metadata, and OS junk
      if (
        !relativePath ||
        relativePath.startsWith('.git/') ||
        relativePath.includes('.DS_Store') ||
        relativePath.includes('Thumbs.db')
      ) {
        continue;
      }

      // Security verify: ensure no accidental test/solution leak inside starter
      const lower = relativePath.toLowerCase();
      if (lower.includes('solution') || lower.startsWith('tests/') || lower.includes('/tests/')) {
        this.logger.warn(`Suspicious file skipped in starter [${language}]: ${relativePath}`);
        continue;
      }

      // Preserve executable bit if file is a shell script (.sh) or similar
      const isExecutable = relativePath.endsWith('.sh') || relativePath.endsWith('.bin');
      const mode = isExecutable ? 0o755 : 0o644;

      entries.push({
        path: relativePath,
        content: buffer,
        mode,
      });
    }

    if (entries.length === 0) {
      throw new Error(`Cannot package starter for language '${language}': no files found under ${starterPrefix}`);
    }

    return buildDeterministicZip(entries);
  }

  /**
   * Builds deterministic test bundle tarball (tar.gz) for a chapter.
   * Includes handrail/tests/* files plus manifest.json with step requirements and hidden flags.
   */
  packageTestBundle(chapterTree: Map<string, Buffer>, chapter: ParsedChapter): Buffer {
    const testPrefix = 'handrail/tests/';
    const entries: ArchiveEntry[] = [];

    for (const [filePath, buffer] of chapterTree.entries()) {
      if (!filePath.startsWith(testPrefix)) {
        continue;
      }

      const relativePath = filePath.substring(testPrefix.length);
      if (
        !relativePath ||
        relativePath.startsWith('.git/') ||
        relativePath.includes('.DS_Store')
      ) {
        continue;
      }

      const isExecutable = relativePath.endsWith('.sh');
      const mode = isExecutable ? 0o755 : 0o644;

      // Map to tests/<path> inside tarball
      entries.push({
        path: `tests/${relativePath}`,
        content: buffer,
        mode,
      });
    }

    // Build manifest.json
    const manifest = {
      chapterId: chapter.id,
      order: chapter.order,
      steps: chapter.steps.map((s) => ({
        stepId: s.id,
        order: s.order,
        title: s.title,
        tests: s.tests.map((testId) => {
          const testDef = chapter.tests[testId];
          return {
            id: testId,
            description: testDef?.description || '',
            hidden: Boolean(testDef?.hidden),
          };
        }),
      })),
    };

    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
    entries.push({
      path: 'manifest.json',
      content: manifestBuf,
      mode: 0o644,
    });

    return buildDeterministicTar(entries);
  }
}
