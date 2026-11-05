import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { PrismaService } from '../prisma.service.js';
import type { ContentLevel, ContentKind } from '@app/contracts';

@Injectable()
export class ContentSyncService {
  private readonly logger = new Logger(ContentSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncFromDirectory(contentDir: string) {
    if (!fs.existsSync(contentDir)) {
      throw new Error(`Content directory not found: ${contentDir}`);
    }

    const workshopFolders = fs
      .readdirSync(contentDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const results = [];
    for (const slug of workshopFolders) {
      const result = await this.syncWorkshop(path.join(contentDir, slug), slug);
      results.push(result);
    }

    return { syncedWorkshops: results.length, details: results };
  }

  private async syncWorkshop(workshopPath: string, slug: string) {
    const workshopYaml = yaml.parse(
      fs.readFileSync(path.join(workshopPath, 'workshop.yaml'), 'utf8'),
    );
    const overviewMdx = fs.existsSync(path.join(workshopPath, 'overview.mdx'))
      ? fs.readFileSync(path.join(workshopPath, 'overview.mdx'), 'utf8')
      : '';

    // 1. Upsert Workshop
    const workshop = await this.prisma.workshop.upsert({
      where: { slug },
      update: {
        title: workshopYaml.title,
        summary: workshopYaml.summary,
        difficulty: workshopYaml.difficulty,
        estimatedTime: workshopYaml.estimated_time,
        prerequisites: workshopYaml.prerequisites || [],
        limitations: workshopYaml.limitations || [],
        whatWeBuild: workshopYaml.what_we_build,
        whatYouLearn: workshopYaml.what_you_learn || [],
      },
      create: {
        slug,
        title: workshopYaml.title,
        summary: workshopYaml.summary,
        difficulty: workshopYaml.difficulty,
        estimatedTime: workshopYaml.estimated_time,
        prerequisites: workshopYaml.prerequisites || [],
        limitations: workshopYaml.limitations || [],
        whatWeBuild: workshopYaml.what_we_build,
        whatYouLearn: workshopYaml.what_you_learn || [],
      },
    });

    // 2. Sync Workshop Languages
    for (const lang of workshopYaml.languages || []) {
      await this.prisma.workshopLanguage.upsert({
        where: {
          workshopId_language: {
            workshopId: workshop.id,
            language: lang,
          },
        },
        update: {},
        create: {
          workshopId: workshop.id,
          language: lang,
        },
      });
    }

    // 3. Sync Chapters
    const chaptersDir = path.join(workshopPath, 'chapters');
    if (fs.existsSync(chaptersDir)) {
      const chapterDirs = fs
        .readdirSync(chaptersDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const chapterSlug of chapterDirs) {
        const chapterPath = path.join(chaptersDir, chapterSlug);
        const chapterYaml = yaml.parse(
          fs.readFileSync(path.join(chapterPath, 'chapter.yaml'), 'utf8'),
        );

        const chapter = await this.prisma.chapter.upsert({
          where: {
            workshopId_slug: {
              workshopId: workshop.id,
              slug: chapterSlug,
            },
          },
          update: {
            title: chapterYaml.title,
            summary: chapterYaml.summary,
            orderIndex: chapterYaml.order_index,
          },
          create: {
            workshopId: workshop.id,
            slug: chapterSlug,
            title: chapterYaml.title,
            summary: chapterYaml.summary,
            orderIndex: chapterYaml.order_index,
          },
        });

        // 4. Sync Steps
        const stepsDir = path.join(chapterPath, 'steps');
        if (fs.existsSync(stepsDir)) {
          const stepDirs = fs
            .readdirSync(stepsDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);

          for (const stepSlug of stepDirs) {
            const stepPath = path.join(stepsDir, stepSlug);
            const stepYaml = yaml.parse(
              fs.readFileSync(path.join(stepPath, 'step.yaml'), 'utf8'),
            );

            const step = await this.prisma.step.upsert({
              where: {
                chapterId_slug: {
                  chapterId: chapter.id,
                  slug: stepSlug,
                },
              },
              update: {
                title: stepYaml.title,
                globalOrder: stepYaml.global_order,
              },
              create: {
                chapterId: chapter.id,
                slug: stepSlug,
                title: stepYaml.title,
                globalOrder: stepYaml.global_order,
              },
            });

            // 5. Sync Step Tests
            const tests = stepYaml.tests || [];
            for (const t of tests) {
              await this.prisma.stepTest.upsert({
                where: {
                  stepId_testId: {
                    stepId: step.id,
                    testId: t.test_id,
                  },
                },
                update: {
                  description: t.description,
                  isHidden: t.is_hidden ?? false,
                },
                create: {
                  stepId: step.id,
                  testId: t.test_id,
                  description: t.description,
                  isHidden: t.is_hidden ?? false,
                },
              });
            }

            // 6. Sync Step Contents (task, theory, hints across beginner, intermediate, expert)
            const levels: ContentLevel[] = ['beginner', 'intermediate', 'expert'];
            const kinds: ContentKind[] = ['task', 'theory', 'hint'];

            for (const level of levels) {
              for (const kind of kinds) {
                const fileName = kind === 'hint' ? `hints.${level}.mdx` : `${kind}.${level}.mdx`;
                const filePath = path.join(stepPath, fileName);
                if (fs.existsSync(filePath)) {
                  const mdx = fs.readFileSync(filePath, 'utf8');
                  await this.prisma.stepContent.upsert({
                    where: {
                      stepId_kind_level: {
                        stepId: step.id,
                        kind: kind as any,
                        level: level as any,
                      },
                    },
                    update: { mdx },
                    create: {
                      stepId: step.id,
                      kind: kind as any,
                      level: level as any,
                      mdx,
                    },
                  });
                }
              }
            }
          }
        }
      }
    }

    this.logger.log(`Synced workshop: ${slug}`);
    return { slug, title: workshopYaml.title, status: 'synced' };
  }
}

