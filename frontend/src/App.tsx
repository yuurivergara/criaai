import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE } from './apiConfig';
import { JobLoadingScreen } from './JobLoadingScreen';

type Mode = 'clone';
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'blocked';

interface JobRecord {
  id: string;
  type: Mode | 'generate' | 'publish';
  status: JobStatus;
  updatedAt: string;
}

function CloneConsole() {
  const [cloneUrl, setCloneUrl] = useState('');
  const [objective, setObjective] = useState('');
  const [cta, setCta] = useState('Começar agora');
  const [workspaceId, setWorkspaceId] = useState('workspace-alpha');
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!activeJobIds.length) {
      return;
    }
    const interval = window.setInterval(async () => {
      const updates = await Promise.all(
        activeJobIds.map(async (jobId) => {
          try {
            const response = await fetch(`${API_BASE}/jobs/${jobId}`);
            if (!response.ok) return null;
            return (await response.json()) as JobRecord;
          } catch {
            return null;
          }
        }),
      );
      const valid = updates.filter((item): item is JobRecord => item !== null);
      if (!valid.length) return;
      setJobs((current) => current.map((job) => valid.find((item) => item.id === job.id) ?? job));
      setActiveJobIds((current) =>
        current.filter(
          (id) =>
            !valid.some(
              (job) => job.id === id && job.status !== 'processing' && job.status !== 'pending',
            ),
        ),
      );
    }, 1200);
    return () => window.clearInterval(interval);
  }, [activeJobIds]);

  useEffect(() => {
    const endpoint = API_BASE.replace(/\/v1$/, '');
    let socket: Socket | null = null;
    try {
      socket = io(`${endpoint}/jobs`, { transports: ['websocket'] });
      socket.on('job.updated', (job: JobRecord) => {
        setJobs((current) => {
          const existing = current.find((item) => item.id === job.id);
          if (existing) {
            return current.map((item) => (item.id === job.id ? job : item));
          }
          return [job, ...current].slice(0, 8);
        });
        if (job.status !== 'pending' && job.status !== 'processing') {
          setActiveJobIds((current) => current.filter((id) => id !== job.id));
        }
      });
    } catch {
      /* socket opcional */
    }
    return () => {
      socket?.disconnect();
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    try {
      const parsed = new URL(cloneUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, [cloneUrl, busy]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setError('Informe uma URL válida (começando com http:// ou https://).');
      return;
    }
    const progressTab = window.open('about:blank', '_blank');
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        sourceUrl: cloneUrl,
        objective: objective || 'Clone fiel otimizado para conversão',
        cta,
        workspaceId: workspaceId || 'workspace-alpha',
      };
      const response = await fetch(`${API_BASE}/pages/clone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        progressTab?.close();
        const errorText = await response.text();
        throw new Error(errorText || 'Não foi possível iniciar a clonagem');
      }
      const data = (await response.json()) as { jobId: string };
      const seed: JobRecord = {
        id: data.jobId,
        type: 'clone',
        status: 'pending',
        updatedAt: new Date().toISOString(),
      };
      setJobs((current) => [seed, ...current].slice(0, 8));
      setActiveJobIds((current) => [...current, data.jobId]);

      if (progressTab) {
        const url = new URL(window.location.href);
        url.searchParams.set('jobLoading', data.jobId);
        url.searchParams.set('mode', 'clone');
        progressTab.location.href = url.toString();
        setMessage('Clone iniciado — o editor abriu em uma nova aba.');
      } else {
        setMessage('Clone iniciado, mas seu navegador bloqueou o pop-up. Abra o editor pelo job abaixo.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao iniciar o clone.');
    } finally {
      setBusy(false);
    }
  };

  const openJob = (jobId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('jobLoading', jobId);
    url.searchParams.set('mode', 'clone');
    window.open(url.toString(), '_blank');
  };

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-bg-orb orb-a" />
        <div className="landing-bg-orb orb-b" />
        <div className="landing-bg-grid" />
      </div>

      <header className="landing-nav">
        <div className="landing-brand">
          <span className="landing-brand-mark">C</span>
          <span className="landing-brand-text">
            CriaAI <em>Clone</em>
          </span>
        </div>
        <nav className="landing-nav-links">
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="landing-nav-link"
          >
            Docs
          </a>
          <span className="landing-nav-pill">Beta</span>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <span className="landing-kicker">Clone · Edite · Publique</span>
          <h1 className="landing-title">
            Clone qualquer página{' '}
            <span className="landing-title-gradient">em segundos</span>
          </h1>
          <p className="landing-subtitle">
            Cole a URL da landing que você quer replicar. Nossa IA reconstrói a estrutura,
            copy, checkouts e vídeos — e abre um editor visual para você personalizar.
          </p>

          <form className="clone-card" onSubmit={onSubmit}>
            <label className="clone-card-label" htmlFor="cloneUrl">
              URL que você quer clonar
            </label>
            <div className="clone-input-row">
              <div className="clone-input-wrap">
                <svg
                  className="clone-input-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  id="cloneUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://exemplo.com/pagina-para-clonar"
                  value={cloneUrl}
                  onChange={(event) => {
                    setCloneUrl(event.target.value);
                    if (error) setError('');
                  }}
                  required
                  disabled={busy}
                />
                {cloneUrl && !busy ? (
                  <button
                    type="button"
                    className="clone-input-clear"
                    onClick={() => setCloneUrl('')}
                    aria-label="Limpar URL"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <button
                type="submit"
                className="clone-cta"
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
              >
                {busy ? (
                  <>
                    <span className="clone-cta-spinner" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    Clonar página
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              className="clone-advanced-toggle"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
            >
              <span>Opções avançadas</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className={advancedOpen ? 'rot' : ''}
              >
                <path
                  d="m6 9 6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {advancedOpen ? (
              <div className="clone-advanced">
                <label className="clone-field">
                  <span>Objetivo</span>
                  <input
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    placeholder="Reescrever para capturar leads B2B"
                    disabled={busy}
                  />
                </label>
                <label className="clone-field">
                  <span>CTA principal</span>
                  <input
                    value={cta}
                    onChange={(event) => setCta(event.target.value)}
                    placeholder="Começar agora"
                    disabled={busy}
                  />
                </label>
                <label className="clone-field">
                  <span>Workspace</span>
                  <input
                    value={workspaceId}
                    onChange={(event) => setWorkspaceId(event.target.value)}
                    placeholder="workspace-alpha"
                    maxLength={80}
                    disabled={busy}
                  />
                </label>
              </div>
            ) : null}

            {error ? <p className="clone-error">{error}</p> : null}
            {message && !error ? <p className="clone-message">{message}</p> : null}
          </form>

          <ul className="landing-features">
            <li>
              <strong>Render fiel</strong>
              <span>Estrutura, tipografia e assets preservados</span>
            </li>
            <li>
              <strong>Editor visual</strong>
              <span>Clique em qualquer elemento e edite ao vivo</span>
            </li>
            <li>
              <strong>Publish instantâneo</strong>
              <span>Subdomínio pronto em segundos</span>
            </li>
          </ul>
        </section>

        {jobs.length > 0 ? (
          <section className="landing-jobs" aria-label="Clones recentes">
            <div className="landing-jobs-head">
              <h3>Clones recentes</h3>
              <span className="landing-jobs-meta">{jobs.length} registro(s)</span>
            </div>
            <ul>
              {jobs.map((job) => {
                const done = job.status === 'completed';
                const failed = job.status === 'failed' || job.status === 'blocked';
                return (
                  <li key={job.id} className={`landing-job status-${job.status}`}>
                    <div className="landing-job-info">
                      <div className={`landing-job-dot ${job.status}`} />
                      <div>
                        <strong>{job.id.slice(0, 8)}…</strong>
                        <small>
                          {new Date(job.updatedAt).toLocaleString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      </div>
                    </div>
                    <span className={`landing-job-status ${job.status}`}>
                      {statusLabel(job.status)}
                    </span>
                    <button
                      type="button"
                      className="landing-job-open"
                      onClick={() => openJob(job.id)}
                      disabled={failed}
                      title={done ? 'Abrir editor' : 'Abrir progresso'}
                    >
                      {done ? 'Abrir editor' : failed ? '—' : 'Acompanhar'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </main>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} CriaAI</span>
        <span>
          Backend · <code>{API_BASE}</code>
        </span>
      </footer>
    </div>
  );
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'pending':
      return 'Na fila';
    case 'processing':
      return 'Processando';
    case 'completed':
      return 'Concluído';
    case 'failed':
      return 'Falhou';
    case 'blocked':
      return 'Bloqueado';
    default:
      return status;
  }
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const jobLoading = params.get('jobLoading');
  if (jobLoading) {
    return <JobLoadingScreen jobId={jobLoading} mode="clone" />;
  }
  return <CloneConsole />;
}

export default App;
