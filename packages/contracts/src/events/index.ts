export const RMQ_QUEUES = {
  PROGRESS: 'progress_queue',
  REALTIME: 'realtime_queue',
  VERIFICATION: 'verification_queue',
} as const;

export const EVENT_PATTERNS = {
  RUN_QUEUED: 'run.queued',
  RUN_STARTED: 'run.started',
  RUN_PROGRESS: 'run.progress',
  RUN_COMPLETED: 'run.completed',
  RUN_PASSED: 'run.passed',
  RUN_FAILED: 'run.failed',
  STEP_UNLOCKED: 'step.unlocked',
} as const;

export interface RunStartedPayload {
  runId: string;
  userId: string;
  workshopSlug: string;
  chapterSlug: string;
  stepSlug: string;
  language: string;
  startedAt: string;
}

export interface RunCompletedPayload {
  runId: string;
  userId: string;
  workshopSlug: string;
  chapterSlug: string;
  stepSlug: string;
  language: string;
  verdict: 'PASSED' | 'FAILED';
  completedAt: string;
  results: Array<{
    testId: string;
    passed: boolean;
    durationMs: number;
    error?: string;
  }>;
}

export interface StepUnlockedPayload {
  userId: string;
  workshopSlug: string;
  chapterSlug: string;
  stepSlug: string;
  globalOrder: number;
  unlockedAt: string;
}

