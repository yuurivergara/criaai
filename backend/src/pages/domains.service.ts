import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Snapshot of a CustomDomain returned by the API. Sensitive bits stay
 * server-side; the token is exposed because the user needs it to publish
 * the verification TXT record.
 */
export interface CustomDomainView {
  id: string;
  pageId: string;
  host: string;
  status: 'pending' | 'verified' | 'active' | 'error';
  verificationToken: string;
  verifiedAt?: string;
  lastCheckedAt?: string;
  lastCheckMessage?: string;
  label?: string;
  /** Computed instructions ready for the UI to render verbatim. */
  dns: {
    txtName: string;
    txtValue: string;
    cnameName: string;
    cnameTarget: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Custom domain lifecycle:
 *
 *   pending  → user just added the host. We hand back a TXT token + CNAME
 *              instructions. Nothing is served on this host yet.
 *   verified → TXT record present and matches our token. Eligible to be
 *              activated; we keep this transient state mostly for UI clarity.
 *   active   → host is being routed to the page bundle. Middleware looks
 *              ONLY at active domains.
 *   error    → last check failed. We expose the message so the user can fix.
 *
 * Verification uses a random 32-hex token under `_criaai-verify.<host>`.
 * Once verified the domain is auto-promoted to `active` so the user doesn't
 * need a second click.
 */
@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Hostname of the platform that user CNAMEs into. */
  private get platformHost(): string {
    const fromEnv = process.env.CRIAAI_PUBLIC_HOST?.trim();
    if (fromEnv) return fromEnv.toLowerCase();
    const base =
      process.env.CRIAAI_PUBLIC_PAGE_BASE_URL?.trim() ||
      process.env.PUBLIC_BASE_URL?.trim();
    if (base) {
      try {
        return new URL(base).host.toLowerCase();
      } catch {
        /* fall through */
      }
    }
    return 'app.criaai.local';
  }

  private normalizeHost(raw: string): string {
    const trimmed = (raw ?? '').trim().toLowerCase();
    if (!trimmed) {
      throw new BadRequestException('Host obrigatório');
    }
    let host: string;
    try {
      const withScheme = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `http://${trimmed}`;
      host = new URL(withScheme).hostname.toLowerCase();
    } catch {
      throw new BadRequestException('Host inválido');
    }
    if (!/^[a-z0-9.-]+$/.test(host)) {
      throw new BadRequestException('Host contém caracteres inválidos');
    }
    if (!host.includes('.')) {
      throw new BadRequestException('Host precisa de um TLD (ex: meusite.com)');
    }
    if (host.length > 253) {
      throw new BadRequestException('Host longo demais');
    }
    if (host === this.platformHost) {
      throw new BadRequestException(
        'Use o domínio próprio, não o da plataforma',
      );
    }
    return host;
  }

  private toView(d: {
    id: string;
    pageId: string;
    host: string;
    status: string;
    verificationToken: string;
    verifiedAt: Date | null;
    lastCheckedAt: Date | null;
    lastCheckMessage: string | null;
    label: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CustomDomainView {
    return {
      id: d.id,
      pageId: d.pageId,
      host: d.host,
      status: d.status as CustomDomainView['status'],
      verificationToken: d.verificationToken,
      verifiedAt: d.verifiedAt?.toISOString(),
      lastCheckedAt: d.lastCheckedAt?.toISOString(),
      lastCheckMessage: d.lastCheckMessage ?? undefined,
      label: d.label ?? undefined,
      dns: {
        txtName: `_criaai-verify.${d.host}`,
        txtValue: `criaai-verify=${d.verificationToken}`,
        cnameName: d.host,
        cnameTarget: this.platformHost,
      },
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async list(pageId: string): Promise<CustomDomainView[]> {
    const rows = await this.prisma.customDomain.findMany({
      where: { pageId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async create(
    pageId: string,
    hostRaw: string,
    label?: string,
  ): Promise<CustomDomainView> {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Página não encontrada');

    const host = this.normalizeHost(hostRaw);

    const existing = await this.prisma.customDomain.findUnique({
      where: { host },
    });
    if (existing) {
      // If it belongs to the same page, just return it (idempotent).
      if (existing.pageId === pageId) return this.toView(existing);
      throw new ConflictException('Domínio já está em uso por outra página');
    }

    const id = randomUUID();
    const verificationToken = randomBytes(16).toString('hex');
    const now = new Date();

    const created = await this.prisma.customDomain.create({
      data: {
        id,
        pageId,
        host,
        verificationToken,
        status: 'pending',
        label: label?.trim() || null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toView(created);
  }

  async remove(pageId: string, domainId: string): Promise<void> {
    const row = await this.prisma.customDomain.findUnique({
      where: { id: domainId },
    });
    if (row?.pageId !== pageId) {
      throw new NotFoundException('Domínio não encontrado');
    }
    await this.prisma.customDomain.delete({ where: { id: domainId } });
    this.invalidateHostCache(row.host);
  }

  /**
   * Look up `_criaai-verify.<host>` TXT records and check that any of them
   * matches our token. Promotes pending → active on success, switches to
   * error otherwise. Idempotent — safe to call repeatedly from the UI.
   */
  async verify(pageId: string, domainId: string): Promise<CustomDomainView> {
    const row = await this.prisma.customDomain.findUnique({
      where: { id: domainId },
    });
    if (row?.pageId !== pageId) {
      throw new NotFoundException('Domínio não encontrado');
    }

    const txtName = `_criaai-verify.${row.host}`;
    const expected = `criaai-verify=${row.verificationToken}`;
    let nextStatus: 'active' | 'error' = 'error';
    let message = '';

    try {
      const records = await dns.resolveTxt(txtName);
      // resolveTxt returns string[][]; flatten and try to match.
      const flat = records.map((parts) => parts.join(''));
      const ok = flat.some((value) => value.trim() === expected);
      if (ok) {
        nextStatus = 'active';
        message = 'TXT verificado com sucesso';
      } else {
        message = `TXT encontrado mas valor não bate. Esperado: ${expected}. Encontrado: ${flat.slice(0, 3).join(' | ') || '(nenhum)'}`;
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'DNS_ERROR';
      if (code === 'ENOTFOUND' || code === 'ENODATA') {
        message = `Nenhum registro TXT encontrado em ${txtName}. Aguarde a propagação do DNS (até 30 min) e tente novamente.`;
      } else if (code === 'ESERVFAIL') {
        message = `Servidor DNS rejeitou a consulta (${code}). Verifique a configuração da zona.`;
      } else {
        message = `Falha na consulta DNS: ${code}`;
      }
      this.logger.debug(`Domain verify failed for ${row.host}: ${message}`);
    }

    const now = new Date();
    const updated = await this.prisma.customDomain.update({
      where: { id: domainId },
      data: {
        status: nextStatus,
        verifiedAt: nextStatus === 'active' ? now : row.verifiedAt,
        lastCheckedAt: now,
        lastCheckMessage: message,
        updatedAt: now,
      },
    });
    this.invalidateHostCache(row.host);
    return this.toView(updated);
  }

  /**
   * Used by the host-routing middleware. Returns the slug of the active
   * domain matching `host`, or null when the host doesn't belong to any
   * verified custom domain. Cached in-memory for a short window so we don't
   * hit Postgres on every request.
   */
  private readonly hostCache = new Map<
    string,
    { slug: string | null; expiresAt: number }
  >();
  private readonly hostCacheTtlMs = 30_000;

  async resolveSlugForHost(hostRaw: string): Promise<string | null> {
    const host = (hostRaw ?? '').toLowerCase().split(':')[0].trim();
    if (!host) return null;
    const cached = this.hostCache.get(host);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.slug;

    const row = await this.prisma.customDomain.findUnique({ where: { host } });
    let slug: string | null = null;
    if (row?.status === 'active') {
      const page = await this.prisma.page.findUnique({
        where: { id: row.pageId },
      });
      if (page?.status === 'published' && page.slug) {
        slug = page.slug;
      }
    }
    this.hostCache.set(host, { slug, expiresAt: now + this.hostCacheTtlMs });
    return slug;
  }

  /** Manual cache invalidation for tests / admin actions. */
  invalidateHostCache(host?: string): void {
    if (host) this.hostCache.delete(host.toLowerCase());
    else this.hostCache.clear();
  }
}
