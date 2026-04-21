export type PageSourceType = 'generate' | 'clone';
export type PageStatus = 'draft' | 'published';

export interface PageVersion {
  id: string;
  pageId: string;
  title: string;
  html: string;
  createdAt: string;
  meta: Record<string, unknown>;
}

export interface PageRecord {
  id: string;
  sourceType: PageSourceType;
  status: PageStatus;
  sourceUrl?: string;
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
  latestVersionId?: string;
}
