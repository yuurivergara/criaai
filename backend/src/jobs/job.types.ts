export type JobType = 'generate' | 'clone' | 'publish';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'blocked';

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  /** Owner of the job. null for legacy rows + system-internal jobs. */
  userId?: string | null;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}
