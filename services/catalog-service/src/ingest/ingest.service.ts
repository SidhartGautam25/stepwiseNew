import { Injectable, Logger } from '@nestjs/common';
import {
  buildWorkshopSnapshot,
  lintWorkshop,
  type WorkshopSnapshot,
} from '@app/content-core';
import { PrismaService } from '../prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ContentSourceFactory } from '../content-source/content-source.factory.js';
import { PackagingService } from './packaging.service.js';
import type { IngestJob } from './ingest-job.interface.js';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly contentSourceFactory: ContentSourceFactory,
    private readonly packaging: PackagingService,
  ) {}

  async processJob(job: IngestJob): Promise<{ success: boolean; versionId?: string; error?: string }> {
    const { workshopSlug, trigger, force } = job;
    this.logger.log(`Starting ingest job for [${workshopSlug}] (trigger: ${trigger})`);

    const workshop = await this.prisma.workshop.findUnique({
      where: { slug: workshopSlug },
    });

    if (!workshop) {
      throw new Error(`Workshop with slug "${workshopSlug}" not registered`);
    }

    const ingestRun = await this.prisma.ingestRun.create({
      data: {
        workshopId: workshop.id,
        trigger: trigger as any,
        status: 'running',
      },
    });

    try {
      const source = this.contentSourceFactory.create(
        workshop.repoFullName,
        workshop.installationId,
      );

      // 1. Resolve branch tips
      const tips = await source.listBranchTips();
      const mainSha = tips.get('main');
      if (!mainSha) {
        throw new Error(`Repository ${workshop.repoFullName} is missing "main" branch`);
      }

      await this.prisma.ingestRun.update({
        where: { id: ingestRun.id },
        data: { mainSha },
      });

      // 2. Idempotency check: see if current draft already matches all SHAs
      const existingDraft = await this.prisma.workshopVersion.findFirst({
        where: { workshopId: workshop.id, kind: 'draft' },
        include: { chapters: true },
      });

      if (existingDraft && !force) {
        const isMainIdentical = existingDraft.mainSha === mainSha;
        const chaptersList = existingDraft.chapters || [];
        let areChaptersIdentical = true;

        for (const [branch, sha] of tips.entries()) {
          if (branch.startsWith('chapter/')) {
            const chMatch = chaptersList.find((c) => c.branch === branch);
            if (!chMatch || chMatch.commitSha !== sha) {
              areChaptersIdentical = false;
              break;
            }
          }
        }

        if (isMainIdentical && areChaptersIdentical && chaptersList.length > 0) {
          this.logger.log(
            `Draft for [${workshopSlug}] already up to date with branch tips. Reusing draft ${existingDraft.id}`,
          );
          await this.prisma.ingestRun.update({
            where: { id: ingestRun.id },
            data: {
              status: 'completed',
              logExcerpt: 'Idempotent: draft already matches current branch tips.',
            },
          });
          return { success: true, versionId: existingDraft.id };
        }
      }

      // 3. Read main tree and chapter trees
      const mainTree = await source.readTree(mainSha);
      const chapterTrees = new Map<string, Map<string, Buffer>>();
      const chapterShas = new Map<string, string>();

      for (const [branch, sha] of tips.entries()) {
        if (branch.startsWith('chapter/')) {
          chapterShas.set(branch, sha);
          const chTree = await source.readTree(sha);
          chapterTrees.set(branch, chTree);
        }
      }

      // 4. Build snapshot and lint
      const snapshot: WorkshopSnapshot = buildWorkshopSnapshot({
        mainTree,
        chapterTrees,
        mainSha,
        chapterShas,
      });

      const lintReport = lintWorkshop({
        mainTree,
        chapterTrees,
      });
      const hasErrors = !lintReport.valid || lintReport.errorCount > 0;

      if (hasErrors) {
        const excerpt = JSON.stringify(lintReport.diagnostics, null, 2);
        this.logger.error(`Snapshot lint failed for [${workshopSlug}] with ${lintReport.errorCount} errors`);

        // Record failed draft version with lint report
        await this.prisma.$transaction(async (tx) => {
          let draft = await tx.workshopVersion.findFirst({
            where: { workshopId: workshop.id, kind: 'draft' },
          });

          if (!draft) {
            draft = await tx.workshopVersion.create({
              data: {
                workshopId: workshop.id,
                version: 'draft',
                kind: 'draft',
                mainSha,
                lintReportJson: lintReport as any,
              },
            });
          } else {
            await tx.workshopVersion.update({
              where: { id: draft.id },
              data: {
                mainSha,
                lintReportJson: lintReport as any,
              },
            });
          }

          await tx.ingestRun.update({
            where: { id: ingestRun.id },
            data: {
              status: 'failed',
              error: `Snapshot failed linting with ${lintReport.errorCount} error(s)`,
              logExcerpt: excerpt.slice(0, 4000),
            },
          });
        });

        return {
          success: false,
          error: `Lint errors found: ${lintReport.errorCount} error(s)`,
        };
      }

      // 5. Package and upload artifacts to S3
      const artifactDescriptors: Array<{
        kind: 'starter_zip' | 'test_bundle';
        language?: string;
        chapterKey?: string;
        storageKey: string;
        sha256: string;
        size: number;
      }> = [];

      // Starters (one per language)
      for (const lang of snapshot.workshop.languages) {
        const starterZip = this.packaging.packageStarter(mainTree, lang);
        const storageKey = `workshops/${workshop.slug}/draft/starters/${lang}.zip`;
        const res = await this.storage.putObject(storageKey, starterZip, 'application/zip');
        artifactDescriptors.push({
          kind: 'starter_zip',
          language: lang,
          storageKey: res.key,
          sha256: res.sha256,
          size: res.size,
        });
      }

      // Test bundles (one per chapter)
      for (const chapter of snapshot.chapters) {
        const chTree = chapterTrees.get(chapter.branch);
        if (!chTree) {
          throw new Error(`Tree not found for branch ${chapter.branch}`);
        }
        const testTar = this.packaging.packageTestBundle(chTree, chapter);
        const storageKey = `workshops/${workshop.slug}/draft/chapters/${chapter.id}/tests.tar.gz`;
        const res = await this.storage.putObject(storageKey, testTar, 'application/gzip');
        artifactDescriptors.push({
          kind: 'test_bundle',
          chapterKey: chapter.id,
          storageKey: res.key,
          sha256: res.sha256,
          size: res.size,
        });
      }

      // 6. Transactional Database update
      const versionId = await this.prisma.$transaction(async (tx) => {
        let draft = await tx.workshopVersion.findFirst({
          where: { workshopId: workshop.id, kind: 'draft' },
        });

        if (!draft) {
          draft = await tx.workshopVersion.create({
            data: {
              workshopId: workshop.id,
              version: 'draft',
              kind: 'draft',
              mainSha,
              lintReportJson: lintReport as any,
            },
          });
        } else {
          // Clean up old artifacts & chapters for clean rewrite
          await tx.artifact.deleteMany({ where: { versionId: draft.id } });
          await tx.chapter.deleteMany({ where: { versionId: draft.id } });
          await tx.workshopOverview.deleteMany({ where: { versionId: draft.id } });

          await tx.workshopVersion.update({
            where: { id: draft.id },
            data: {
              mainSha,
              lintReportJson: lintReport as any,
            },
          });
        }

        // Create WorkshopOverview
        await tx.workshopOverview.create({
          data: {
            versionId: draft.id,
            sectionsJson: snapshot.overview as any,
          },
        });

        // Create Chapters, Steps, Content & Intros
        const chapterIdMap = new Map<string, string>();

        for (const ch of snapshot.chapters) {
          const manifest = {
            chapterId: ch.id,
            order: ch.order,
            steps: ch.steps.map((s) => ({
              stepKey: s.id,
              tests: s.tests.map((testId) => ({
                id: testId,
                description: ch.tests[testId]?.description || '',
                hidden: Boolean(ch.tests[testId]?.hidden),
              })),
            })),
          };

          const createdChapter = await tx.chapter.create({
            data: {
              versionId: draft.id,
              orderNo: ch.order,
              chapterKey: ch.id,
              title: ch.title,
              summary: ch.summary,
              estMinutes: ch.estMinutes,
              branch: ch.branch,
              commitSha: ch.commitSha,
              manifestJson: manifest as any,
            },
          });
          chapterIdMap.set(ch.id, createdChapter.id);

          // Chapter Intros
          for (const level of ['beginner', 'intermediate', 'expert'] as const) {
            const introMd = ch.intro[level];
            if (introMd) {
              await tx.chapterIntro.create({
                data: {
                  chapterId: createdChapter.id,
                  level,
                  md: introMd,
                },
              });
            }
          }

          // Steps
          for (const step of ch.steps) {
            const createdStep = await tx.step.create({
              data: {
                chapterId: createdChapter.id,
                orderInChapter: step.order,
                stepKey: step.id,
                title: step.title,
              },
            });

            // Step Contents
            for (const level of ['beginner', 'intermediate', 'expert'] as const) {
              const content = step.content[level];
              if (content) {
                if (content.task) {
                  await tx.stepContent.create({
                    data: {
                      stepId: createdStep.id,
                      kind: 'task',
                      level,
                      md: content.task,
                    },
                  });
                }
                if (content.theory) {
                  await tx.stepContent.create({
                    data: {
                      stepId: createdStep.id,
                      kind: 'theory',
                      level,
                      md: content.theory,
                    },
                  });
                }
                if (content.hints) {
                  await tx.stepContent.create({
                    data: {
                      stepId: createdStep.id,
                      kind: 'hint',
                      level,
                      md: content.hints,
                    },
                  });
                }
              }
            }
          }
        }

        // Create Artifacts
        for (const desc of artifactDescriptors) {
          const chId = desc.chapterKey ? chapterIdMap.get(desc.chapterKey) : undefined;
          await tx.artifact.create({
            data: {
              versionId: draft.id,
              chapterId: chId,
              language: desc.language,
              kind: desc.kind,
              storageKey: desc.storageKey,
              sha256: desc.sha256,
              size: desc.size,
            },
          });
        }

        await tx.ingestRun.update({
          where: { id: ingestRun.id },
          data: {
            status: 'completed',
            logExcerpt: `Ingest completed successfully. ${snapshot.chapters.length} chapters, ${artifactDescriptors.length} artifacts generated.`,
          },
        });

        return draft.id;
      });

      this.logger.log(`Ingest job for [${workshopSlug}] completed successfully: draft version ${versionId}`);
      return { success: true, versionId };
    } catch (err: any) {
      this.logger.error(`Ingest job failed for [${workshopSlug}]: ${err.message}`, err.stack);
      await this.prisma.ingestRun.update({
        where: { id: ingestRun.id },
        data: {
          status: 'failed',
          error: err.message,
          logExcerpt: err.stack?.slice(0, 4000),
        },
      });
      return { success: false, error: err.message };
    }
  }
}
