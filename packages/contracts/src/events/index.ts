export const RMQ_QUEUES = {
  PROGRESS: 'progress_queue',
  REALTIME: 'realtime_queue',
  VERIFICATION: 'verification_queue',
} as const;

export const EVENT_PATTERNS = {
  USER_REGISTERED: 'auth.user.registered',
  RUN_QUEUED: 'run.queued',
  RUN_STARTED: 'run.started',
  RUN_PROGRESS: 'run.progress',
  RUN_COMPLETED: 'run.completed',
  RUN_PASSED: 'run.passed',
  RUN_FAILED: 'run.failed',
  STEP_UNLOCKED: 'step.unlocked',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  ENROLLMENT_CREATED: 'profile.enrollment.created',
} as const;

export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: string;
  version: string;
  occurredAt: string;
  correlationId: string;
  data: T;
}

export interface UserRegisteredV1 {
  userId: string;
  email: string;
  displayName?: string;
  provider: string;
}

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

export interface PaymentSucceededPayload {
  orderId: string;
  paymentId: string;
  userId: string;
  workshopSlug: string;
  amount: number;
  currency: string;
  paidAt: string;
}

export interface EnrollmentCreatedPayload {
  userId: string;
  workshopSlug: string;
  language: string;
  enrolledAt: string;
}



