import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { DomainsService } from './domains.service';

/**
 * Maps requests arriving on a custom domain back to the canonical
 * `/v1/public/<slug>[/<stepId>]` route, so the existing
 * `PublicPagesController` serves them transparently.
 *
 * Trigger conditions (request is rewritten only when ALL hold):
 *   1. Request method is GET (we don't proxy POST/PUT/etc).
 *   2. Path is "/" or "/something" (no API call).
 *   3. Host header matches an ACTIVE custom domain in the DB.
 *
 * Anything else falls through untouched — the editor/API on the platform
 * domain keep working normally.
 *
 * The slug lookup is cached for 30s inside DomainsService so this
 * middleware costs essentially nothing on the hot path.
 */
@Injectable()
export class CustomDomainMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CustomDomainMiddleware.name);

  constructor(private readonly domainsService: DomainsService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    // Skip API/editor paths — only the public-page surface is proxied.
    const path = req.path ?? req.url ?? '/';
    if (
      path.startsWith('/v1/') ||
      path.startsWith('/api/') ||
      path.startsWith('/socket.io') ||
      path.startsWith('/_next') ||
      path === '/favicon.ico'
    ) {
      next();
      return;
    }

    const hostHeader =
      typeof req.headers.host === 'string' ? req.headers.host : '';
    if (!hostHeader) {
      next();
      return;
    }

    try {
      const slug = await this.domainsService.resolveSlugForHost(hostHeader);
      if (!slug) {
        next();
        return;
      }

      // Rewrite the URL so PublicPagesController matches naturally.
      // "/" → "/v1/public/<slug>"
      // "/q05" → "/v1/public/<slug>/q05"
      // Preserves any query string.
      const cleanPath = path === '/' || path === '' ? '' : path;
      const stepSegment = cleanPath.replace(/^\/+/, '');
      const rewritten = stepSegment
        ? `/v1/public/${encodeURIComponent(slug)}/${encodeURIComponent(stepSegment)}`
        : `/v1/public/${encodeURIComponent(slug)}`;
      const search = req.url?.includes('?')
        ? req.url.slice(req.url.indexOf('?'))
        : '';
      req.url = `${rewritten}${search}`;
      next();
    } catch (err) {
      this.logger.warn(
        `Custom domain rewrite failed for host=${hostHeader}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      next();
    }
  }
}
