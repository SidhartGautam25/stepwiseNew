import path from 'node:path';
import fs from 'node:fs';
import * as yaml from 'yaml';
import * as crypto from 'node:crypto';

// Load root .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function syncContentToCatalog() {
  const contentDir = path.resolve(process.cwd(), 'content');
  if (!fs.existsSync(contentDir)) {
    console.error(`[Handrail Content Sync] Content directory not found: ${contentDir}`);
    return false;
  }

  console.log(`[Handrail Content Sync] Scanning workshops in: ${contentDir}...`);

  const { PrismaClient } = await import(
    '../services/catalog-service/src/generated/client/index.js'
  );

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL_CATALOG ||
          'postgresql://handrail:handrail_password@localhost:5432/handrail_db?schema=catalog',
      },
    },
  });

  try {
    const folders = fs
      .readdirSync(contentDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    let syncedCount = 0;

    for (const slug of folders) {
      const workshopPath = path.join(contentDir, slug);
      const workshopYamlPath = path.join(workshopPath, 'workshop.yaml');
      const chaptersDir = path.join(workshopPath, 'chapters');
      if (!fs.existsSync(workshopYamlPath) || !fs.existsSync(chaptersDir)) continue;

      const workshopYaml = yaml.parse(fs.readFileSync(workshopYamlPath, 'utf8'));
      const overviewMdxPath = path.join(workshopPath, 'overview.mdx');
      const overviewMdx = fs.existsSync(overviewMdxPath)
        ? fs.readFileSync(overviewMdxPath, 'utf8')
        : '';

      console.log(`\n[Handrail Content Sync] Syncing: ${slug} ("${workshopYaml.title}")`);

      // 1. Upsert Workshop
      const workshop = await prisma.workshop.upsert({
        where: { slug },
        update: {
          repoFullName: `handrail/${slug}`,
          access: 'public',
          status: 'active',
        },
        create: {
          slug,
          repoFullName: `handrail/${slug}`,
          access: 'public',
          status: 'active',
        },
      });

      // 2. Upsert Published Version (1.0.0)
      const version = await prisma.workshopVersion.upsert({
        where: {
          workshopId_version: {
            workshopId: workshop.id,
            version: '1.0.0',
          },
        },
        update: {
          kind: 'published',
          mainSha: 'main',
          publishedAt: new Date(),
        },
        create: {
          workshopId: workshop.id,
          version: '1.0.0',
          kind: 'published',
          mainSha: 'main',
          publishedAt: new Date(),
        },
      });

      // 3. Mark version as latestPublishedId
      await prisma.workshop.update({
        where: { id: workshop.id },
        data: { latestPublishedId: version.id },
      });

      // 4. Upsert WorkshopOverview
      const sectionsJson = {
        title: workshopYaml.title,
        summary: workshopYaml.summary,
        difficulty: workshopYaml.difficulty || 'Intermediate',
        estimatedTime: workshopYaml.estimated_time || '4 - 6 hours',
        whatWeBuild: workshopYaml.what_we_build || overviewMdx || workshopYaml.summary,
        whatYouLearn: workshopYaml.what_you_learn || [],
        prerequisites: workshopYaml.prerequisites || [],
        limitations: workshopYaml.limitations || [],
        howItWorks: workshopYaml.summary,
        languages: workshopYaml.languages || ['go', 'python'],
      };

      await prisma.workshopOverview.upsert({
        where: { versionId: version.id },
        update: { sectionsJson },
        create: {
          versionId: version.id,
          sectionsJson,
        },
      });

      // 5. Upsert Starter Artifacts
      const languages = workshopYaml.languages || ['go', 'python'];
      for (const lang of languages) {
        const dummySha = crypto.createHash('sha256').update(`${slug}-${lang}`).digest('hex');
        const artifactId = `${version.id}-${lang}-starter`;

        const existingArtifact = await prisma.artifact.findFirst({
          where: {
            versionId: version.id,
            kind: 'starter_zip',
            language: lang,
          },
        });

        if (!existingArtifact) {
          await prisma.artifact.create({
            data: {
              versionId: version.id,
              kind: 'starter_zip',
              language: lang,
              storageKey: `starters/${slug}/${lang}.zip`,
              sha256: dummySha,
              size: 1024,
            },
          });
        }
      }

      // 6. Sync Chapters & Steps
      if (fs.existsSync(chaptersDir)) {
        const chapterDirs = fs
          .readdirSync(chaptersDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort();

        let chapterOrder = 1;
        let globalStepOrder = 1;

        for (const chapterFolder of chapterDirs) {
          const chapterPath = path.join(chaptersDir, chapterFolder);
          const chapterYamlPath = path.join(chapterPath, 'chapter.yaml');
          if (!fs.existsSync(chapterYamlPath)) continue;

          const chapterYaml = yaml.parse(fs.readFileSync(chapterYamlPath, 'utf8'));
          const chapterKey = chapterFolder;

          const chapter = await prisma.chapter.upsert({
            where: {
              versionId_chapterKey: {
                versionId: version.id,
                chapterKey,
              },
            },
            update: {
              title: chapterYaml.title || chapterFolder,
              summary: chapterYaml.summary || '',
              orderNo: chapterYaml.order_index ?? chapterOrder,
              branch: 'main',
              commitSha: 'main',
            },
            create: {
              versionId: version.id,
              chapterKey,
              title: chapterYaml.title || chapterFolder,
              summary: chapterYaml.summary || '',
              orderNo: chapterYaml.order_index ?? chapterOrder,
              branch: 'main',
              commitSha: 'main',
            },
          });

          chapterOrder++;

          // Steps
          const stepsDir = path.join(chapterPath, 'steps');
          if (fs.existsSync(stepsDir)) {
            const stepDirs = fs
              .readdirSync(stepsDir, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => d.name)
              .sort();

            let stepOrderInChapter = 1;

            for (const stepFolder of stepDirs) {
              const stepPath = path.join(stepsDir, stepFolder);
              const stepYamlPath = path.join(stepPath, 'step.yaml');
              if (!fs.existsSync(stepYamlPath)) continue;

              const stepYaml = yaml.parse(fs.readFileSync(stepYamlPath, 'utf8'));
              const stepKey = stepFolder;

              const step = await prisma.step.upsert({
                where: {
                  chapterId_stepKey: {
                    chapterId: chapter.id,
                    stepKey,
                  },
                },
                update: {
                  title: stepYaml.title || stepFolder,
                  orderInChapter: stepOrderInChapter,
                },
                create: {
                  chapterId: chapter.id,
                  stepKey,
                  title: stepYaml.title || stepFolder,
                  orderInChapter: stepOrderInChapter,
                },
              });

              stepOrderInChapter++;
              globalStepOrder++;

              // Step Contents (MDX)
              const levels = ['beginner', 'intermediate', 'expert'] as const;
              const kinds = ['task', 'theory', 'hint'] as const;

              for (const level of levels) {
                for (const kind of kinds) {
                  const filename =
                    kind === 'hint' ? `hints.${level}.mdx` : `${kind}.${level}.mdx`;
                  const mdxPath = path.join(stepPath, filename);

                  if (fs.existsSync(mdxPath)) {
                    const md = fs.readFileSync(mdxPath, 'utf8');

                    await prisma.stepContent.upsert({
                      where: {
                        stepId_kind_level: {
                          stepId: step.id,
                          kind,
                          level,
                        },
                      },
                      update: { md },
                      create: {
                        stepId: step.id,
                        kind,
                        level,
                        md,
                      },
                    });
                  }
                }
              }
            }
          }
        }
      }

      syncedCount++;
      console.log(`  ✓ Successfully synced and published "${slug}"`);
    }

    console.log(`\n🎉 Content Sync Completed: ${syncedCount} workshops published in catalog!`);
    return true;
  } catch (err: any) {
    console.error(`[Handrail Content Sync] Error: ${err.message}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

syncContentToCatalog()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
