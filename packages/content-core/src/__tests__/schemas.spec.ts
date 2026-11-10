import { describe, it, expect } from 'vitest';
import { WorkshopSchema } from '../schemas/workshop.schema.js';
import { ChapterSchema } from '../schemas/chapter.schema.js';
import { TestSchema } from '../schemas/test.schema.js';
import { StarterHandrailSchema } from '../schemas/starter-handrail.schema.js';

describe('Content Core Schemas', () => {
  it('validates a correct workshop.yaml config', () => {
    const valid = {
      slug: 'build-your-own-redis',
      title: 'Build your own Redis',
      summary: 'Learn network programming by building an in-memory key-value store',
      difficulty: 'intermediate',
      estimated_hours: 12,
      access: 'free',
      languages: ['go', 'python'],
      prerequisites: ['Basic socket programming'],
      chapters: ['bind-port', 'ping-pong'],
    };

    const result = WorkshopSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid workshop slug with uppercase or spaces', () => {
    const invalid = {
      slug: 'Build Your Own Redis',
      title: 'Redis',
      summary: 'Test',
      difficulty: 'beginner',
      estimated_hours: 5,
      languages: ['go'],
      chapters: ['ch1'],
    };
    const result = WorkshopSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates a chapter.yaml config', () => {
    const valid = {
      id: 'bind-port',
      title: 'Bind to a port',
      summary: 'Listen for TCP connections',
      est_minutes: 45,
      steps: [
        {
          id: 'create-socket',
          title: 'Create a socket',
          tests: ['test-create-socket'],
        },
      ],
    };
    const result = ChapterSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects chapter with empty steps', () => {
    const invalid = {
      id: 'bind-port',
      title: 'Bind',
      summary: 'Summary',
      est_minutes: 30,
      steps: [],
    };
    const result = ChapterSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates test.yaml schema with defaults', () => {
    const valid = {
      id: 'test-ping',
      description: 'Verifies response to PING command',
    };
    const parsed = TestSchema.parse(valid);
    expect(parsed.id).toBe('test-ping');
    expect(parsed.hidden).toBe(false);
    expect(parsed.timeout_seconds).toBe(30);
  });

  it('validates starter handrail.yaml schema', () => {
    const valid = {
      build: ['go', 'build', '-o', 'app', '.'],
      run: {
        default: ['./app'],
        windows: ['app.exe'],
      },
    };
    const result = StarterHandrailSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
