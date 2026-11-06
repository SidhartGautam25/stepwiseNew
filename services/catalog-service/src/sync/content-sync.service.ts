import { Injectable, Logger, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { ContentSyncRepository } from './content-sync.repository.js';
import type { ContentLevel, ContentKind } from '@app/contracts';

@Injectable()
export class ContentSyncService {
  private readonly logger = new Logger(ContentSyncService.name);

  constructor(
    @Inject(ContentSyncRepository)
    private readonly contentSyncRepo: ContentSyncRepository,
  ) {}

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

    // 1. Upsert Workshop via Repository
    const workshop = await this.contentSyncRepo.upsertWorkshop({
      slug,
      title: workshopYaml.title,
      summary: workshopYaml.summary,
      difficulty: workshopYaml.difficulty,
      estimatedTime: workshopYaml.estimated_time,
      prerequisites: workshopYaml.prerequisites || [],
      limitations: workshopYaml.limitations || [],
      whatWeBuild: workshopYaml.what_we_build,
      whatYouLearn: workshopYaml.what_you_learn || [],
    });

    // 2. Sync Workshop Languages via Repository
    for (const lang of workshopYaml.languages || []) {
      await this.contentSyncRepo.upsertWorkshopLanguage(workshop.id, lang);
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

        const chapter = await this.contentSyncRepo.upsertChapter({
          workshopId: workshop.id,
          slug: chapterSlug,
          title: chapterYaml.title,
          summary: chapterYaml.summary,
          orderIndex: chapterYaml.order_index,
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

            const step = await this.contentSyncRepo.upsertStep({
              chapterId: chapter.id,
              slug: stepSlug,
              title: stepYaml.title,
              globalOrder: stepYaml.global_order,
            });

            // 5. Sync Step Tests via Repository
            const tests = stepYaml.tests || [];
            for (const t of tests) {
              await this.contentSyncRepo.upsertStepTest({
                stepId: step.id,
                testId: t.test_id,
                description: t.description,
                isHidden: t.is_hidden ?? false,
              });
            }

            // 6. Sync Step Contents via Repository
            const levels: ContentLevel[] = ['beginner', 'intermediate', 'expert'];
            const kinds: ContentKind[] = ['task', 'theory', 'hint'];

            for (const level of levels) {
              for (const kind of kinds) {
                const fileName = kind === 'hint' ? `hints.${level}.mdx` : `${kind}.${level}.mdx`;
                const filePath = path.join(stepPath, fileName);
                if (fs.existsSync(filePath)) {
                  const mdx = fs.readFileSync(filePath, 'utf8');
                  await this.contentSyncRepo.upsertStepContent({
                    stepId: step.id,
                    kind,
                    level,
                    mdx,
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

