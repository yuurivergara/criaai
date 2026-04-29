import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DomainsService } from './domains.service';

/**
 * Internal endpoint consumed by Caddy's `on_demand_tls.ask` directive.
 *
 * Caddy will only attempt to obtain a Let's Encrypt cert for an inbound
 * hostname if THIS endpoint returns HTTP 200. We return 200 only when the
 * domain is registered AND verified (status === 'active'). Anything else
 * answers 404 so Caddy aborts the cert flow.
 *
 * Hardening tips for production:
 *   - Bind this controller behind a private network or basic auth header
 *     so random callers can't enumerate active domains.
 *   - Cache the lookup (DomainsService already memoizes for 30s).
 */
@ApiTags('internal')
@Controller('internal/domains')
export class InternalDomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @ApiOperation({
    summary: 'Caddy on_demand_tls ask endpoint. 200 = issue cert, 404 = abort.',
  })
  @Get('ask')
  async ask(
    @Query('domain') domain: string,
    @Res() res: Response,
  ): Promise<void> {
    const slug = await this.domainsService.resolveSlugForHost(domain ?? '');
    if (slug) {
      res.status(200).send('ok');
    } else {
      res.status(404).send('unknown');
    }
  }
}
