import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { IngestService } from './ingest.service.js';
import { PackagingService } from './packaging.service.js';
import { ContentSourceFactory } from '../content-source/content-source.factory.js';

describe('Ingest Pipeline Integration Test (LocalGitSource + sample-workshop-repo)', () => {
  let ingestService: IngestService;
  let mockPrisma: any;
  let uploadedArtifacts: Map<string, { buffer: Buffer; sha256: string; size: number }>;

  const db = {
    workshops: new Map<string, any>(),
    versions: new Map<string, any>(),
    overviews: new Map<string, any>(),
    chapters: new Map<string, any>(),
    intros: new Map<string, any>(),
    steps: new Map<string, any>(),
    contents: new Map<string, any>(),
    artifacts: new Map<string, any>(),
    ingestRuns: new Map<string, any>(),
  };

  beforeEach(() => {
    db.workshops.clear();
    db.versions.clear();
    db.overviews.clear();
    db.chapters.clear();
    db.intros.clear();
    db.steps.clear();
    db.contents.clear();
    db.artifacts.clear();
    db.ingestRuns.clear();
    uploadedArtifacts = new Map();

    // Find workspace root
    let root = process.cwd();
    while (root !== path.dirname(root)) {
      if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) break;
      root = path.dirname(root);
    }
    const sampleRepoPath = path.resolve(root, 'content', 'sample-workshop-repo');
    db.workshops.set('build-your-own-http-server', {
      id: 'ws-http-1',
      slug: 'build-your-own-http-server',
      repoFullName: sampleRepoPath,
      installationId: null,
      access: 'public',
      status: 'active',
      latestPublishedId: null,
    });

    mockPrisma = {
      workshop: {
        findUnique: async ({ where }: any) => db.workshops.get(where.slug) || null,
        update: async ({ where, data }: any) => {
          const ws = Array.from(db.workshops.values()).find((w) => w.id === where.id);
          Object.assign(ws, data);
          return ws;
        },
      },
      workshopVersion: {
        findFirst: async ({ where, include }: any) => {
          const ver = Array.from(db.versions.values()).find(
            (v) => v.workshopId === where.workshopId && (!where.kind || v.kind === where.kind),
          );
          if (!ver) return null;
          if (include?.chapters) {
            return {
              ...ver,
              chapters: Array.from(db.chapters.values()).filter((c) => c.versionId === ver.id),
            };
          }
          return ver;
        },
        create: async ({ data }: any) => {
          const id = `ver-${crypto.randomUUID()}`;
          const ver = { id, ...data };
          db.versions.set(id, ver);
          return ver;
        },
        update: async ({ where, data }: any) => {
          const ver = db.versions.get(where.id);
          Object.assign(ver, data);
          return ver;
        },
      },
      workshopOverview: {
        deleteMany: async () => {},
        create: async ({ data }: any) => {
          const id = `ov-${crypto.randomUUID()}`;
          const ov = { id, ...data };
          db.overviews.set(id, ov);
          return ov;
        },
      },
      chapter: {
        deleteMany: async () => {
          db.chapters.clear();
        },
        create: async ({ data }: any) => {
          const id = `ch-${crypto.randomUUID()}`;
          const ch = { id, ...data };
          db.chapters.set(id, ch);
          return ch;
        },
      },
      chapterIntro: {
        create: async ({ data }: any) => {
          const id = `intro-${crypto.randomUUID()}`;
          db.intros.set(id, { id, ...data });
          return { id, ...data };
        },
      },
      step: {
        create: async ({ data }: any) => {
          const id = `step-${crypto.randomUUID()}`;
          const st = { id, ...data };
          db.steps.set(id, st);
          return st;
        },
      },
      stepContent: {
        create: async ({ data }: any) => {
          const id = `sc-${crypto.randomUUID()}`;
          db.contents.set(id, { id, ...data });
          return { id, ...data };
        },
      },
      artifact: {
        deleteMany: async () => {
          db.artifacts.clear();
        },
        create: async ({ data }: any) => {
          const id = `art-${crypto.randomUUID()}`;
          const art = { id, ...data };
          db.artifacts.set(id, art);
          return art;
        },
      },
      ingestRun: {
        create: async ({ data }: any) => {
          const id = `run-${crypto.randomUUID()}`;
          const run = { id, ...data };
          db.ingestRuns.set(id, run);
          return run;
        },
        update: async ({ where, data }: any) => {
          const run = db.ingestRuns.get(where.id);
          Object.assign(run, data);
          return run;
        },
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    const mockStorage: any = {
      putObject: async (key: string, body: Buffer) => {
        const sha256 = crypto.createHash('sha256').update(body).digest('hex');
        uploadedArtifacts.set(key, { buffer: body, sha256, size: body.length });
        return { key, sha256, size: body.length };
      },
    };

    const mockConfig: any = {
      contentSource: 'local',
      contentLocalRepos: './content',
    };
    const mockGitHubAuth: any = {};
    const contentSourceFactory = new ContentSourceFactory(mockConfig, mockGitHubAuth);
    const packagingService = new PackagingService();

    ingestService = new IngestService(
      mockPrisma,
      mockStorage,
      contentSourceFactory,
      packagingService,
    );
  });

  it('performs full ingest of sample repo: parses, lints, packages, uploads, and persists to DB', async () => {
    const result = await ingestService.processJob({
      workshopSlug: 'build-your-own-http-server',
      trigger: 'manual',
    });

    expect(result.success).toBe(true);
    expect(result.versionId).toBeDefined();

    // Verify Chapters
    expect(db.chapters.size).toBe(3);
    const chapterKeys = Array.from(db.chapters.values()).map((c) => c.chapterKey);
    expect(chapterKeys).toContain('bind-port');
    expect(chapterKeys).toContain('parse-request');
    expect(chapterKeys).toContain('concurrent-connections');

    // Verify Steps
    expect(db.steps.size).toBe(6); // 2 steps per chapter * 3 chapters

    // Verify Step Content
    expect(db.contents.size).toBeGreaterThan(0);

    // Verify Artifacts in S3
    expect(uploadedArtifacts.size).toBe(5); // 2 starters (go, python) + 3 test bundles

    const starterKeys = Array.from(uploadedArtifacts.keys()).filter((k) => k.includes('/starters/'));
    expect(starterKeys).toHaveLength(2);
    expect(starterKeys.some((k) => k.endsWith('go.zip'))).toBe(true);
    expect(starterKeys.some((k) => k.endsWith('python.zip'))).toBe(true);

    const testBundleKeys = Array.from(uploadedArtifacts.keys()).filter((k) => k.includes('/tests.tar.gz'));
    expect(testBundleKeys).toHaveLength(3);

    // Verify IngestRun completed
    const runs = Array.from(db.ingestRuns.values());
    expect(runs[0].status).toBe('completed');
  });

  it('idempotently reuses existing draft when branch tips have not changed', async () => {
    // 1st run
    const res1 = await ingestService.processJob({
      workshopSlug: 'build-your-own-http-server',
      trigger: 'manual',
    });
    expect(res1.success).toBe(true);

    const artifactsCountBefore = uploadedArtifacts.size;

    // 2nd run without force
    const res2 = await ingestService.processJob({
      workshopSlug: 'build-your-own-http-server',
      trigger: 'manual',
    });

    expect(res2.success).toBe(true);
    expect(res2.versionId).toBe(res1.versionId);
    // Artifacts were not re-uploaded because draft was reused
    expect(uploadedArtifacts.size).toBe(artifactsCountBefore);

    const runs = Array.from(db.ingestRuns.values());
    expect(runs[1].status).toBe('completed');
    expect(runs[1].logExcerpt).toContain('Idempotent');
  });
});
