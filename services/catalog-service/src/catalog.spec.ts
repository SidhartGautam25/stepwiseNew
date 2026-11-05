import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from './catalog/catalog.service.js';

describe('CatalogService', () => {
  let service: CatalogService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      workshop: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    service = new CatalogService(mockPrisma);
  });

  it('lists workshops and calculates total steps', async () => {
    mockPrisma.workshop.findMany.mockResolvedValue([
      {
        id: 'w1',
        slug: 'build-your-own-redis',
        title: 'Build Your Own Redis',
        summary: 'In-memory Redis server',
        difficulty: 'Intermediate',
        estimatedTime: '4 - 6 hours',
        languages: [{ language: 'go' }, { language: 'python' }],
        chapters: [
          { steps: [{ id: 's1' }, { id: 's2' }] },
          { steps: [{ id: 's3' }, { id: 's4' }] },
        ],
      },
    ]);

    const result = await service.listWorkshops();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('build-your-own-redis');
    expect(result[0].totalSteps).toBe(4);
    expect(result[0].languages).toEqual(['go', 'python']);
  });

  it('retrieves workshop overview with chapters and steps', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'w1',
      slug: 'build-your-own-redis',
      title: 'Build Your Own Redis',
      summary: 'In-memory Redis server',
      difficulty: 'Intermediate',
      estimatedTime: '4 - 6 hours',
      prerequisites: ['TCP/IP'],
      limitations: ['No cluster'],
      whatWeBuild: 'Redis clone',
      whatYouLearn: ['RESP parser'],
      languages: [{ language: 'go' }],
      chapters: [
        {
          id: 'c1',
          slug: '01-tcp-handshake',
          title: 'TCP Handshake',
          summary: 'Socket setup',
          orderIndex: 1,
          steps: [
            {
              id: 's1',
              slug: '01-bind-port',
              title: 'Bind Port',
              globalOrder: 1,
              tests: [{ id: 't1' }],
            },
          ],
        },
      ],
    });

    const overview = await service.getWorkshopOverview('build-your-own-redis');
    expect(overview.slug).toBe('build-your-own-redis');
    expect(overview.chapters).toHaveLength(1);
    expect(overview.chapters[0].steps).toHaveLength(1);
    expect(overview.chapters[0].steps[0].testCount).toBe(1);
  });

  it('retrieves step details with 3-level content prefetch mapping', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'w1',
      slug: 'build-your-own-redis',
      chapters: [
        {
          slug: '01-tcp-handshake',
          steps: [
            {
              id: 's1',
              slug: '01-bind-port',
              title: 'Bind Port',
              globalOrder: 1,
              tests: [{ testId: 't1', description: 'Bind test', isHidden: false }],
              contents: [
                { kind: 'task', level: 'beginner', mdx: 'Task Beginner' },
                { kind: 'task', level: 'intermediate', mdx: 'Task Intermediate' },
                { kind: 'task', level: 'expert', mdx: 'Task Expert' },
                { kind: 'theory', level: 'beginner', mdx: 'Theory Beginner' },
                { kind: 'theory', level: 'intermediate', mdx: 'Theory Intermediate' },
                { kind: 'theory', level: 'expert', mdx: 'Theory Expert' },
              ],
            },
          ],
        },
      ],
    });

    const stepDetail = await service.getStepDetail('build-your-own-redis', '01-bind-port', 'beginner');
    expect(stepDetail.slug).toBe('01-bind-port');
    expect(stepDetail.currentLevel).toBe('beginner');
    expect(stepDetail.taskMdx).toBe('Task Beginner');
    expect(stepDetail.allLevelsContent).toBeDefined();
    expect(stepDetail.allLevelsContent?.expert?.task).toBe('Task Expert');
    expect(stepDetail.tests).toHaveLength(1);
  });
});
