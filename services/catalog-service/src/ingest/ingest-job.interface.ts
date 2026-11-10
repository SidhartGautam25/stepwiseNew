export interface IngestJob {
  workshopSlug: string;
  trigger: 'webhook' | 'manual' | 'publish';
  force?: boolean;
  mainSha?: string;
  installationId?: string;
}
