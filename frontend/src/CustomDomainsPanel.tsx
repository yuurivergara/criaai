import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from './apiConfig';
import { useAuth } from './auth/AuthContext';

/**
 * Shape returned by GET/POST /v1/pages/:pageId/domains. Mirrors
 * `CustomDomainView` on the backend.
 */
interface CustomDomainView {
  id: string;
  pageId: string;
  host: string;
  status: 'pending' | 'verified' | 'active' | 'error';
  verificationToken: string;
  verifiedAt?: string;
  lastCheckedAt?: string;
  lastCheckMessage?: string;
  label?: string;
  dns: {
    txtName: string;
    txtValue: string;
    cnameName: string;
    cnameTarget: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Props {
  readonly pageId: string;
  /** True when page has at least one publish — domains only make sense after publishing. */
  readonly isPublished: boolean;
  /** Link público no domínio da CriaAI; permanece válido junto com domínios próprios. */
  readonly platformPublicUrl?: string;
}

const STATUS_BADGE: Record<CustomDomainView['status'], { label: string; tone: string }> = {
  pending: { label: 'Aguardando verificação', tone: '#b08900' },
  verified: { label: 'Verificado', tone: '#0f7b6c' },
  active: { label: 'Ativo', tone: '#0f7b6c' },
  error: { label: 'Erro', tone: '#c53030' },
};

/**
 * UI for attaching custom domains to a published page. Renders a list of
 * existing domains with verification instructions and a form to add new
 * ones. All network calls go to /v1/pages/:pageId/domains.
 */
export function CustomDomainsPanel({
  pageId,
  isPublished,
  platformPublicUrl,
}: Props) {
  const { authFetch } = useAuth();
  const [domains, setDomains] = useState<CustomDomainView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newHost, setNewHost] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/pages/${pageId}/domains`);
      if (!res.ok) throw new Error(`Falha ao carregar domínios (${res.status})`);
      const data = (await res.json()) as CustomDomainView[];
      setDomains(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [authFetch, pageId]);

  useEffect(() => {
    if (isPublished) void refresh();
  }, [isPublished, refresh]);

  const handleAdd = useCallback(
    async (event: React.SyntheticEvent) => {
      event.preventDefault();
      if (!newHost.trim()) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await authFetch(`${API_BASE}/pages/${pageId}/domains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: newHost.trim(), label: newLabel.trim() || undefined }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Erro ao adicionar (${res.status})`);
        }
        setNewHost('');
        setNewLabel('');
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro desconhecido');
      } finally {
        setSubmitting(false);
      }
    },
    [authFetch, newHost, newLabel, pageId, refresh],
  );

  const handleVerify = useCallback(
    async (domainId: string) => {
      setVerifyingId(domainId);
      setError(null);
      try {
        const res = await authFetch(
          `${API_BASE}/pages/${pageId}/domains/${domainId}/verify`,
          { method: 'POST' },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Erro ao verificar (${res.status})`);
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro desconhecido');
      } finally {
        setVerifyingId(null);
      }
    },
    [authFetch, pageId, refresh],
  );

  const handleRemove = useCallback(
    async (domainId: string) => {
      if (!confirm('Remover este domínio? O quiz deixará de responder por ele.')) return;
      try {
        const res = await authFetch(
          `${API_BASE}/pages/${pageId}/domains/${domainId}`,
          { method: 'DELETE' },
        );
        if (!res.ok && res.status !== 204) {
          throw new Error(`Erro ao remover (${res.status})`);
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro desconhecido');
      }
    },
    [authFetch, pageId, refresh],
  );

  const copy = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      /* ignore */
    }
  }, []);

  if (!isPublished) {
    return (
      <div className="cd-panel cd-panel-disabled">
        <p>
          Publique a página primeiro para liberar a opção de apontar um
          domínio próprio.
        </p>
      </div>
    );
  }

  return (
    <div className="cd-panel">
      <header className="cd-panel-head">
        <div>
          <h4>Domínios personalizados</h4>
          <p>
            Use o domínio do seu cliente (ex: <code>quiz.marca.com</code>) para
            servir esta página. Adicione abaixo, configure os registros DNS e
            clique em verificar.
          </p>
        </div>
      </header>

      {platformPublicUrl ? (
        <div className="cd-platform-link">
          <p className="cd-section-title">Link público CriaAI</p>
          <p className="cd-muted">
            Sempre disponível, mesmo com domínio próprio ativo.
          </p>
          <a href={platformPublicUrl} target="_blank" rel="noreferrer">
            {platformPublicUrl}
          </a>
        </div>
      ) : null}

      <form className="cd-form" onSubmit={handleAdd}>
        <div className="cd-form-row">
          <input
            type="text"
            placeholder="quiz.minhamarca.com"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            disabled={submitting}
            required
          />
          <input
            type="text"
            placeholder="Apelido (opcional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            disabled={submitting}
          />
          <button type="submit" disabled={submitting || !newHost.trim()}>
            {submitting ? 'Adicionando…' : 'Adicionar domínio'}
          </button>
        </div>
      </form>

      {error && <div className="cd-error">{error}</div>}
      {loading && <div className="cd-muted">Carregando…</div>}

      {!loading && domains.length === 0 && (
        <div className="cd-empty">
          Nenhum domínio personalizado configurado ainda.
        </div>
      )}

      <ul className="cd-list">
        {domains.map((d) => {
          const badge = STATUS_BADGE[d.status];
          return (
            <li key={d.id} className={`cd-item cd-item-${d.status}`}>
              <div className="cd-item-head">
                <div>
                  <strong>{d.host}</strong>
                  {d.label && <span className="cd-label">{d.label}</span>}
                </div>
                <span
                  className="cd-status-badge"
                  style={{ background: badge.tone }}
                >
                  {badge.label}
                </span>
              </div>

              <div className="cd-instructions">
                <p className="cd-section-title">
                  1. Aponte o domínio para nossos servidores (CNAME):
                </p>
                <DnsRow
                  type="CNAME"
                  name={d.dns.cnameName}
                  value={d.dns.cnameTarget}
                  copyKey={`cname-${d.id}`}
                  onCopy={copy}
                  copied={copiedField === `cname-${d.id}`}
                />
                <p className="cd-section-title">
                  2. Prove a posse do domínio (TXT):
                </p>
                <DnsRow
                  type="TXT"
                  name={d.dns.txtName}
                  value={d.dns.txtValue}
                  copyKey={`txt-${d.id}`}
                  onCopy={copy}
                  copied={copiedField === `txt-${d.id}`}
                />
              </div>

              {d.lastCheckMessage && d.status !== 'active' && (
                <div className="cd-feedback">{d.lastCheckMessage}</div>
              )}
              {d.status === 'active' && (
                <div className="cd-success">
                  Tudo pronto. Acesse:{' '}
                  <a
                    href={`https://${d.host}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://{d.host}
                  </a>
                </div>
              )}

              <div className="cd-actions">
                <button
                  type="button"
                  className="cd-btn cd-btn-primary"
                  onClick={() => handleVerify(d.id)}
                  disabled={verifyingId === d.id}
                >
                  {verifyingId === d.id ? 'Verificando…' : 'Verificar agora'}
                </button>
                <button
                  type="button"
                  className="cd-btn cd-btn-danger"
                  onClick={() => handleRemove(d.id)}
                >
                  Remover
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface DnsRowProps {
  readonly type: string;
  readonly name: string;
  readonly value: string;
  readonly copyKey: string;
  readonly onCopy: (value: string, key: string) => void;
  readonly copied: boolean;
}

function DnsRow({ type, name, value, copyKey, onCopy, copied }: DnsRowProps) {
  return (
    <div className="cd-dns-row">
      <span className="cd-dns-type">{type}</span>
      <div className="cd-dns-fields">
        <code className="cd-dns-name">{name}</code>
        <code className="cd-dns-value">{value}</code>
      </div>
      <button
        type="button"
        className="cd-btn cd-btn-ghost"
        onClick={() => onCopy(`${name}\t${value}`, copyKey)}
      >
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}
