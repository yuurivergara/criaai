import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../apiConfig';
import { useAuth } from './AuthContext';

interface PageRow {
  id: string;
  sourceType: 'clone' | 'generate' | string;
  status: string;
  sourceUrl: string | null;
  publicUrl: string | null;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  /** Called when the user clicks "Editar" on a page row. */
  readonly onOpenPage: (pageId: string, mode: 'clone' | 'generate') => void;
  /** Called when the user clicks "Nova página" / chooses a flow. */
  readonly onStartNew: (mode: 'clone' | 'generate') => void;
}

/**
 * Logged-in landing screen. Lists every page the user has cloned or
 * generated, with links to open the editor, copy the public URL or remove
 * the page entirely. Also surfaces the "create new" flows.
 */
export function DashboardScreen({ onOpenPage, onStartNew }: Props) {
  const { user, logout, authFetch } = useAuth();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/pages`);
      if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
      const data = (await res.json()) as PageRow[];
      setPages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (pageId: string) => {
      if (!confirm('Excluir esta página? Essa ação não pode ser desfeita.')) {
        return;
      }
      try {
        const res = await authFetch(`${API_BASE}/pages/${pageId}`, {
          method: 'DELETE',
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`Erro ao excluir (${res.status})`);
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro desconhecido');
      }
    },
    [authFetch, refresh],
  );

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div>
          <h1>cria.ai</h1>
          <p>Olá, {user?.name || user?.email || 'usuário'} 👋</p>
        </div>
        <div className="dash-actions">
          <button
            type="button"
            className="dash-btn dash-btn-ghost"
            onClick={() => onStartNew('clone')}
          >
            + Clonar quiz/página
          </button>
          <button
            type="button"
            className="dash-btn dash-btn-primary"
            onClick={() => onStartNew('generate')}
          >
            + Gerar página de venda
          </button>
          <button
            type="button"
            className="dash-btn dash-btn-ghost"
            onClick={logout}
          >
            Sair
          </button>
        </div>
      </header>

      <section className="dash-content">
        <div className="dash-section-head">
          <h2>Minhas páginas</h2>
          <button
            type="button"
            className="dash-btn dash-btn-ghost"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>

        {error && <div className="dash-error">{error}</div>}

        {!loading && pages.length === 0 && !error && (
          <div className="dash-empty">
            Você ainda não criou nenhuma página. Comece clonando um quiz ou
            gerando uma página de venda acima.
          </div>
        )}

        <ul className="dash-list">
          {pages.map((p) => {
            const mode: 'clone' | 'generate' =
              p.sourceType === 'generate' ? 'generate' : 'clone';
            return (
              <li key={p.id} className="dash-item">
                <div className="dash-item-main">
                  <div className="dash-item-title">
                    <span className={`dash-tag dash-tag-${mode}`}>
                      {mode === 'generate' ? 'Gerada' : 'Clonada'}
                    </span>
                    <strong>
                      {p.sourceUrl
                        ? p.sourceUrl.replace(/^https?:\/\//, '').slice(0, 60)
                        : p.slug || p.id.slice(0, 8)}
                    </strong>
                  </div>
                  <div className="dash-item-meta">
                    <span className={`dash-status dash-status-${p.status}`}>
                      {p.status}
                    </span>
                    {p.publicUrl && (
                      <a
                        href={p.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="dash-public"
                      >
                        {p.publicUrl.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    <span className="dash-date">
                      Atualizada em {formatDate(p.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="dash-item-actions">
                  {p.publicUrl ? (
                    <a
                      href={p.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dash-btn dash-btn-site"
                    >
                      Ver site
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="dash-btn dash-btn-primary"
                    onClick={() => onOpenPage(p.id, mode)}
                  >
                    Editar / domínios
                  </button>
                  <button
                    type="button"
                    className="dash-btn dash-btn-danger"
                    onClick={() => void handleDelete(p.id)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
