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
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}
