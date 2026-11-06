import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from './catalog/catalog.service.js';

describe('CatalogService', () => {
  let service: CatalogService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findManyWorkshops: vi.fn(),
      findWorkshopBySlug: vi.fn(),
      findStepWithDetails: vi.fn(),
    };
    service = new CatalogService(mockRepo);
  });

  it('lists workshops strictly from repository and calculates total steps', async () => {
    mockRepo.findManyWorkshops.mockResolvedValue([
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

  it('retrieves workshop overview with chapters and steps strictly from repository', async () => {
    mockRepo.findWorkshopBySlug.mockResolvedValue({
      id: 'w1',
      slug: 'build-your-own-redis',
      title: 'Build Your Own Redis',
      summary: 'In-memory Redis server',
      difficulty: 'Intermediate',
      estimatedTime: '4 - 6 hours',
      prerequisites: ['TCP/IP'],
      limitations: ['Single thread'],
      whatWeBuild: 'Redis clone',
      whatYouLearn: ['TCP'],
      languages: [{ language: 'go' }],
      chapters: [
        {
          id: 'c1',
          slug: '01-tcp',
          title: 'TCP',
          summary: 'TCP setup',
          orderIndex: 1,
          steps: [
            {
              id: 's1',
              slug: '01-bind',
              title: 'Bind',
              globalOrder: 1,
              tests: [{ id: 't1' }],
            },
          ],
        },
      ],
    });

    const result = await service.getWorkshopOverview('build-your-own-redis');
    expect(result.slug).toBe('build-your-own-redis');
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].steps[0].testCount).toBe(1);
  });

  it('retrieves step details with 3-level content prefetch mapping strictly from repository', async () => {
    mockRepo.findStepWithDetails.mockResolvedValue({
      id: 'w1',
      slug: 'build-your-own-redis',
      chapters: [
        {
          id: 'c1',
          slug: '01-tcp',
          steps: [
            {
              id: 's1',
              slug: '01-bind',
              title: 'Bind Port',
              globalOrder: 1,
              tests: [
                {
                  testId: 't1',
                  description: 'binds port',
                  isHidden: false,
                },
              ],
              contents: [
                { level: 'beginner', kind: 'task', mdx: '# Task Beginner' },
                { level: 'beginner', kind: 'theory', mdx: '# Theory Beginner' },
                { level: 'intermediate', kind: 'task', mdx: '# Task Intermediate' },
                { level: 'intermediate', kind: 'theory', mdx: '# Theory Intermediate' },
                { level: 'expert', kind: 'task', mdx: '# Task Expert' },
                { level: 'expert', kind: 'theory', mdx: '# Theory Expert' },
              ],
            },
          ],
        },
      ],
    });

    const result = await service.getStepDetail('build-your-own-redis', '01-bind', 'beginner');
    expect(result.currentLevel).toBe('beginner');
    expect(result.taskMdx).toBe('# Task Beginner');
    expect(result.theoryMdx).toBe('# Theory Beginner');
    expect(result.allLevelsContent?.expert?.task).toBe('# Task Expert');
  });
});
