import path from 'node:path';
import fs from 'node:fs';
import * as yaml from 'yaml';

// Try to load .env from root
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile(envPath);
  } catch {
    // ignore
  }
}

const SYNC_TOKEN = process.env.INTERNAL_SYNC_TOKEN || 'dev_internal_sync_token_secret';
const CATALOG_PORT = process.env.PORT_CATALOG || '4001';
const GATEWAY_PORT = process.env.PORT_API_GATEWAY || '4000';

async function syncDirectToDatabase(contentDir: string): Promise<boolean> {
  console.log('[Handrail Content Sync] Attempting direct PostgreSQL database sync via Prisma Client...');
  try {
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

    const workshopFolders = fs
      .readdirSync(contentDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    console.log(`[Handrail Content Sync] Found ${workshopFolders.length} workshops to sync into catalog schema: ${workshopFolders.join(', ')}`);

    for (const slug of workshopFolders) {
      const workshopPath = path.join(contentDir, slug);
      const workshopYamlPath = path.join(workshopPath, 'workshop.yaml');
      if (!fs.existsSync(workshopYamlPath)) continue;

      const workshopYaml = yaml.parse(fs.readFileSync(workshopYamlPath, 'utf8'));

      // 1. Upsert Workshop
      const workshop = await prisma.workshop.upsert({
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

      // 2. Sync Languages
      for (const lang of workshopYaml.languages || []) {
        await prisma.workshopLanguage.upsert({
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
          const chapterYamlPath = path.join(chapterPath, 'chapter.yaml');
          if (!fs.existsSync(chapterYamlPath)) continue;

          const chapterYaml = yaml.parse(fs.readFileSync(chapterYamlPath, 'utf8'));

          const chapter = await prisma.chapter.upsert({
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
              const stepYamlPath = path.join(stepPath, 'step.yaml');
              if (!fs.existsSync(stepYamlPath)) continue;

              const stepYaml = yaml.parse(fs.readFileSync(stepYamlPath, 'utf8'));

              const step = await prisma.step.upsert({
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

              // 5. Sync Tests
              for (const t of stepYaml.tests || []) {
                await prisma.stepTest.upsert({
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

              // 6. Sync Step Contents
              const levels = ['beginner', 'intermediate', 'expert'] as const;
              const kinds = ['task', 'theory', 'hint'] as const;

              for (const level of levels) {
                for (const kind of kinds) {
                  const fileName = kind === 'hint' ? `hints.${level}.mdx` : `${kind}.${level}.mdx`;
                  const filePath = path.join(stepPath, fileName);
                  if (fs.existsSync(filePath)) {
                    const mdx = fs.readFileSync(filePath, 'utf8');
                    await prisma.stepContent.upsert({
                      where: {
                        stepId_kind_level: {
                          stepId: step.id,
                          kind,
                          level,
                        },
                      },
                      update: { mdx },
                      create: {
                        stepId: step.id,
                        kind,
                        level,
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
      console.log(`  ✓ Synced workshop: ${slug}`);
    }

    await prisma.$disconnect();
    console.log(`\n🎉 Direct PostgreSQL database sync succeeded for all workshops!`);
    return true;
  } catch (err: any) {
    console.warn(`[Handrail Content Sync] Direct database sync failed: ${err.message}`);
    return false;
  }
}

async function main() {
  const contentDir = path.resolve(process.cwd(), 'content');
  console.log(`[Handrail Content Sync] Initiating sync from: ${contentDir}`);

  const targets = [
    `http://localhost:${CATALOG_PORT}/internal/content/sync`,
    `http://localhost:${GATEWAY_PORT}/internal/content/sync`,
  ];

  let success = false;
  for (const url of targets) {
    try {
      console.log(`[Handrail Content Sync] Attempting ${url}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': SYNC_TOKEN,
        },
        body: JSON.stringify({ contentDir }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`\n🎉 Content Sync Succeeded via ${url}!`);
        console.log(JSON.stringify(data, null, 2));
        success = true;
        break;
      }
    } catch {
      // ignore and try next
    }
  }

  if (!success) {
    success = await syncDirectToDatabase(contentDir);
  }

  if (!success) {
    console.error(`\n❌ Content Sync Failed.`);
    console.error(`Please ensure PostgreSQL is running (run: docker compose -f infra/docker-compose.yml up -d)`);
    console.error(`and database tables exist (run: pnpm db:push).`);
    process.exit(1);
  }
}

main();
