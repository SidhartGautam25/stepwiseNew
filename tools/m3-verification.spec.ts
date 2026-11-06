import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { lintContent } from './content-linter/index.js';
import { StarterService } from '../services/starter-service/src/starter.service.js';
import { EnrollmentService } from '../services/progress-service/src/enrollment.service.js';

describe('Milestone 3: Starters, Enrollment & New Workshops Verification', () => {
  const contentDir = path.resolve(process.cwd(), 'content');

  describe('1. Content & Workshop Hierarchy', () => {
    it('verifies all 4 workshops are present: redis, react, git, npm', () => {
      const workshops = fs.readdirSync(contentDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      expect(workshops).toContain('build-your-own-redis');
      expect(workshops).toContain('build-your-own-react');
      expect(workshops).toContain('build-your-own-git');
      expect(workshops).toContain('build-your-own-npm');
    });

    it('passes strict content linter for all workshops (3 levels, tests, sequential order)', () => {
      const result = lintContent(contentDir);
      expect(result.errors).toEqual([]);
      expect(result.success).toBe(true);
    });
  });

  describe('2. Enrollment & Step Progression (progress-service)', () => {
    let enrollmentService: EnrollmentService;
    let enrollmentsMap: Map<string, any>;
    let stepProgressMap: Map<string, any>;

    beforeEach(() => {
      enrollmentsMap = new Map();
      stepProgressMap = new Map();

      const mockPrisma = {
        enrollment: {
          findUnique: async ({ where }: any) => {
            const k = `${where.userId_workshopSlug_language.userId}:${where.userId_workshopSlug_language.workshopSlug}:${where.userId_workshopSlug_language.language}`;
            return enrollmentsMap.get(k) || null;
          },
          create: async ({ data }: any) => {
            const rec = { id: `enroll-${Date.now()}`, ...data, enrolledAt: new Date() };
            const k = `${data.userId}:${data.workshopSlug}:${data.language}`;
            enrollmentsMap.set(k, rec);
            return rec;
          },
          findFirst: async ({ where }: any) => {
            for (const val of enrollmentsMap.values()) {
              if (val.userId === where.userId && val.workshopSlug === where.workshopSlug) {
                const steps: any[] = [];
                for (const sp of stepProgressMap.values()) {
                  if (sp.enrollmentId === val.id) steps.push(sp);
                }
                return { ...val, steps };
              }
            }
            return null;
          },
        },
        stepProgress: {
          findUnique: async ({ where }: any) => {
            const k = `${where.enrollmentId_stepSlug.enrollmentId}:${where.enrollmentId_stepSlug.stepSlug}`;
            return stepProgressMap.get(k) || null;
          },
          create: async ({ data }: any) => {
            const rec = { id: `sp-${Date.now()}-${Math.random()}`, ...data, completedAt: null };
            const k = `${data.enrollmentId}:${data.stepSlug}`;
            stepProgressMap.set(k, rec);
            return rec;
          },
        },
      } as any;

      enrollmentService = new EnrollmentService(mockPrisma);
    });

    const testWorkshops = [
      { slug: 'build-your-own-redis', lang: 'go', firstStepSlug: '01-bind-port' },
      { slug: 'build-your-own-react', lang: 'typescript', firstStepSlug: '01-create-element' },
      { slug: 'build-your-own-git', lang: 'go', firstStepSlug: '01-git-init' },
      { slug: 'build-your-own-npm', lang: 'typescript', firstStepSlug: '01-fetch-manifest' },
    ];

    testWorkshops.forEach(({ slug, lang, firstStepSlug }) => {
      it(`enrolls learner in "${slug}" unlocking first step and locking subsequent steps`, async () => {
        const res = await enrollmentService.enroll(slug, lang, 'test-learner-id');

        expect(res.workshopSlug).toBe(slug);
        expect(res.language).toBe(lang);
        expect(res.firstStep.slug).toBe(firstStepSlug);
        expect(res.firstStep.globalOrder).toBe(1);

        // Step 1 MUST be AVAILABLE
        expect(res.steps[0].status).toBe('AVAILABLE');
        expect(res.steps[0].stepSlug).toBe(firstStepSlug);

        // Remaining steps MUST be LOCKED
        for (let i = 1; i < res.steps.length; i++) {
          expect(res.steps[i].status).toBe('LOCKED');
        }
      });
    });
  });

  describe('3. Starter Bundling & Signed URLs (starter-service)', () => {
    let starterService: StarterService;

    beforeEach(() => {
      const mockPrisma = {
        starterTemplate: {
          upsert: async () => ({ id: 'mock-template' }),
        },
      } as any;
      starterService = new StarterService(mockPrisma);
    });

    const starterCases = [
      { slug: 'build-your-own-redis', lang: 'go' },
      { slug: 'build-your-own-redis', lang: 'python' },
      { slug: 'build-your-own-react', lang: 'typescript' },
      { slug: 'build-your-own-react', lang: 'javascript' },
      { slug: 'build-your-own-git', lang: 'go' },
      { slug: 'build-your-own-git', lang: 'python' },
      { slug: 'build-your-own-npm', lang: 'typescript' },
      { slug: 'build-your-own-npm', lang: 'go' },
    ];

    starterCases.forEach(({ slug, lang }) => {
      it(`packages valid starter zip for (${slug}, ${lang})`, async () => {
        const { buffer, checksum, fileSize } = await starterService.buildArchive(slug, lang);

        expect(buffer).toBeInstanceOf(Buffer);
        expect(fileSize).toBeGreaterThan(100);
        expect(checksum).toHaveLength(64);

        // Magic bytes for PKZIP: PK\x03\x04
        expect(buffer[0]).toBe(0x50);
        expect(buffer[1]).toBe(0x4b);
        expect(buffer[2]).toBe(0x03);
        expect(buffer[3]).toBe(0x04);
      });
    });

    it('generates a signed download URL and clear git instructions', async () => {
      const info = await starterService.getStarterInfo('build-your-own-git', 'go', 'http://localhost:4000');

      expect(info.downloadUrl).toContain('/v1/starters/build-your-own-git/go/download?sig=');
      expect(info.downloadUrl).toContain('&expires=');

      // Verify Git instructions
      expect(info.instructions.gitInit).toBe('git init');
      expect(info.instructions.gitAdd).toBe('git add .');
      expect(info.instructions.gitCommit).toBe('git commit -m "initial starter commit"');
      expect(info.instructions.gitBranch).toBe('git branch -M main');
      expect(info.instructions.gitRemote).toContain('git remote add origin');
      expect(info.instructions.gitPush).toBe('git push -u origin main');
    });

    it('validates signed URL signatures and rejects expired or forged downloads', async () => {
      const now = Math.floor(Date.now() / 1000);
      const validExpires = now + 7200;
      const sig = starterService.generateSignature('build-your-own-react', 'typescript', validExpires);

      // Valid signature succeeds
      const validBuffer = await starterService.getDownloadBuffer(
        'build-your-own-react',
        'typescript',
        sig,
        String(validExpires),
      );
      expect(validBuffer.length).toBeGreaterThan(100);

      // Expired signature fails
      await expect(
        starterService.getDownloadBuffer(
          'build-your-own-react',
          'typescript',
          sig,
          String(now - 10),
        ),
      ).rejects.toThrow();

      // Forged signature fails
      await expect(
        starterService.getDownloadBuffer(
          'build-your-own-react',
          'typescript',
          'forged-hex-signature-1234567890abcdef',
          String(validExpires),
        ),
      ).rejects.toThrow();
    });
  });
});
