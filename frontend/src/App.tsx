import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE } from './apiConfig';
import JobLoadingScreen from './JobLoadingScreen';
import { AuthProvider, useAuth, getStoredAuthToken } from './auth/AuthContext';
import { AuthScreen } from './auth/AuthScreen';
import { DashboardScreen } from './auth/DashboardScreen';
import './auth/auth.css';

/** Authorization header helper used by the legacy fetches in App.tsx. */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredAuthToken();
  const base: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  return { ...base, ...(extra ?? {}) };
}

type Mode = 'clone' | 'generate';
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'blocked';

interface JobRecord {
  id: string;
  type: Mode | 'publish';
  status: JobStatus;
  updatedAt: string;
  result?: { pageId?: string; publicUrl?: string; slug?: string };
}

interface JobsStreamProps {
  jobs: JobRecord[];
  onOpen: (jobId: string, mode: Mode) => void;
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

function JobsStream({ jobs, onOpen }: JobsStreamProps) {
  if (!jobs.length) return null;
  return (
    <section className="landing-jobs" aria-label="Jobs recentes">
      <div className="landing-jobs-head">
        <h3>Trabalhos recentes</h3>
        <span className="landing-jobs-meta">{jobs.length} registro(s)</span>
      </div>
      <ul>
        {jobs.map((job) => {
          const done = job.status === 'completed';
          const failed = job.status === 'failed' || job.status === 'blocked';
          const openMode = job.type === 'publish' ? 'clone' : (job.type as Mode);
          const publicUrl =
            typeof job.result?.publicUrl === 'string'
              ? job.result.publicUrl
              : undefined;
          return (
            <li key={job.id} className={`landing-job status-${job.status}`}>
              <div className="landing-job-info">
                <div className={`landing-job-dot ${job.status}`} />
                <div>
                  <strong>
                    {job.type === 'generate' ? 'Gerada' : job.type === 'clone' ? 'Clone' : 'Publish'}
                    {' · '}
                    {job.id.slice(0, 8)}…
                  </strong>
                  <small>
                    {new Date(job.updatedAt).toLocaleString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </div>
              </div>
              <span className={`landing-job-status ${job.status}`}>{statusLabel(job.status)}</span>
              <div className="landing-job-actions">
                {done && publicUrl ? (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-job-site"
                  >
                    Ver site
                  </a>
                ) : null}
                <button
                  type="button"
                  className="landing-job-open"
                  onClick={() => onOpen(job.id, openMode)}
                  disabled={failed}
                  title={done ? 'Abrir editor' : 'Abrir progresso'}
                >
                  {done ? 'Abrir editor' : failed ? '—' : 'Acompanhar'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------- */
/*  shared job state hook                                              */
/* ----------------------------------------------------------------- */

function useJobsStream() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);

  useEffect(() => {
    if (!activeJobIds.length) return;
    const interval = window.setInterval(async () => {
      const updates = await Promise.all(
        activeJobIds.map(async (jobId) => {
          try {
            const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
              headers: authHeaders(),
            });
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
              (job) =>
                job.id === id && job.status !== 'processing' && job.status !== 'pending',
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
          if (existing) return current.map((item) => (item.id === job.id ? job : item));
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

  const register = (seed: JobRecord) => {
    setJobs((current) => [seed, ...current].slice(0, 8));
    setActiveJobIds((current) => [...current, seed.id]);
  };

  return { jobs, register };
}

/* ----------------------------------------------------------------- */
/*  Clone console                                                      */
/* ----------------------------------------------------------------- */

interface ConsoleProps {
  jobs: JobRecord[];
  onRegister: (job: JobRecord) => void;
  onOpenJob: (jobId: string, mode: Mode) => void;
}

function CloneConsole({ jobs, onRegister, onOpenJob }: ConsoleProps) {
  const [cloneUrl, setCloneUrl] = useState('');
  const [objective, setObjective] = useState('');
  const [cta, setCta] = useState('Começar agora');
  const [workspaceId, setWorkspaceId] = useState('workspace-alpha');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** Troca réguas/sliders JS por campo de texto (recomendado no editor). */
  const [simplifyInteractiveWidgets, setSimplifyInteractiveWidgets] =
    useState(true);

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
        simplifyInteractiveWidgets,
      };
      const response = await fetch(`${API_BASE}/pages/clone`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        progressTab?.close();
        const errorText = await response.text();
        throw new Error(errorText || 'Não foi possível iniciar a clonagem');
      }
      const data = (await response.json()) as { jobId: string };
      onRegister({
        id: data.jobId,
        type: 'clone',
        status: 'pending',
        updatedAt: new Date().toISOString(),
      });

      if (progressTab) {
        const url = new URL(window.location.href);
        url.searchParams.set('jobLoading', data.jobId);
        url.searchParams.set('mode', 'clone');
        progressTab.location.href = url.toString();
        setMessage('Clone iniciado — o editor abriu em uma nova aba.');
      } else {
        setMessage('Clone iniciado, mas seu navegador bloqueou o pop-up. Abra pelo job abaixo.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao iniciar o clone.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="landing-hero">
      <span className="landing-kicker">Clone · Edite · Publique</span>
      <h1 className="landing-title">
        Clone qualquer página <span className="landing-title-gradient">em segundos</span>
      </h1>
      <p className="landing-subtitle">
        Cole a URL da landing que você quer replicar. Nossa IA reconstrói a estrutura, copy,
        checkouts e vídeos — e abre um editor visual para você personalizar.
      </p>

      <form className="clone-card" onSubmit={onSubmit}>
        <label className="clone-card-label" htmlFor="cloneUrl">
          URL que você quer clonar
        </label>
        <div className="clone-input-row">
          <div className="clone-input-wrap">
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
          <button type="submit" className="clone-cta" disabled={!canSubmit}>
            {busy ? (
              <>
                <span className="clone-cta-spinner" />
                Iniciando...
              </>
            ) : (
              <>Clonar página →</>
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
            <label className="clone-field clone-field-checkbox">
              <input
                type="checkbox"
                checked={simplifyInteractiveWidgets}
                onChange={(event) =>
                  setSimplifyInteractiveWidgets(event.target.checked)
                }
                disabled={busy}
              />
              <span>
                Simplificar controles arrastáveis (réguas de altura etc.) para um
                campo de texto editável — melhora o preview e o ZIP.
              </span>
            </label>
          </div>
        ) : null}

        {error ? <p className="clone-error">{error}</p> : null}
        {message && !error ? <p className="clone-message">{message}</p> : null}
      </form>

      <JobsStream jobs={jobs} onOpen={onOpenJob} />
    </section>
  );
}

/* ----------------------------------------------------------------- */
/*  Generate console                                                   */
/* ----------------------------------------------------------------- */

type Tone =
  | 'confident'
  | 'friendly'
  | 'urgent'
  | 'empathetic'
  | 'authoritative'
  | 'playful';

type Language = 'pt-BR' | 'en-US' | 'es-ES';

type Layout = 'vsl-hero' | 'story-driven' | 'authority-led';

interface WizardState {
  // step 1 — product
  productName: string;
  prompt: string;
  niche: string;
  audience: string;
  promise: string;
  // step 2 — differentiation & proof
  uniqueMechanism: string;
  proofPoints: string;
  authorName: string;
  authorRole: string;
  authorBio: string;
  // step 3 — offer & objections
  priceOffer: string;
  guarantee: string;
  cta: string;
  bonuses: string;
  objections: string;
  urgencyHook: string;
  // step 4 — design & assets
  tone: Tone;
  language: Language;
  layoutPreference: '' | Layout;
  palettePreference: string;
  vslUrl: string;
  checkoutUrl: string;
}

const EMPTY_WIZARD: WizardState = {
  productName: '',
  prompt: '',
  niche: '',
  audience: '',
  promise: '',
  uniqueMechanism: '',
  proofPoints: '',
  authorName: '',
  authorRole: '',
  authorBio: '',
  priceOffer: '',
  guarantee: '',
  cta: '',
  bonuses: '',
  objections: '',
  urgencyHook: '',
  tone: 'confident',
  language: 'pt-BR',
  layoutPreference: '',
  palettePreference: '',
  vslUrl: '',
  checkoutUrl: '',
};

const STEP_LABELS = [
  'Produto',
  'Diferencial & Autoridade',
  'Oferta & Objeções',
  'Identidade & Ativos',
];

interface PaletteSwatch {
  id: string;
  name: string;
  vibe: string;
  bg: string;
  surface: string;
  text: string;
  primary: string;
  accent: string;
  gradFrom: string;
  gradTo: string;
}

// These swatches mirror the backend palette tokens
// (backend/src/pages/sales-page-design.util.ts). Keep in sync when adding new
// palettes on the backend.
const PALETTE_SWATCHES: PaletteSwatch[] = [
  {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    vibe: 'premium · tech',
    bg: '#0a0b10',
    surface: '#12141c',
    text: '#eef1f6',
    primary: '#7a5bff',
    accent: '#22d3ee',
    gradFrom: '#a395ff',
    gradTo: '#22d3ee',
  },
  {
    id: 'solar-gold',
    name: 'Solar Gold',
    vibe: 'luxo · high-ticket',
    bg: '#0b0a07',
    surface: '#1a1811',
    text: '#f6efe2',
    primary: '#e2b455',
    accent: '#ff9d4d',
    gradFrom: '#f5cf78',
    gradTo: '#ff9d4d',
  },
  {
    id: 'clinic-trust',
    name: 'Clinic Trust',
    vibe: 'saúde · confiança',
    bg: '#f7f9fc',
    surface: '#ffffff',
    text: '#0f1a2b',
    primary: '#0c7ff2',
    accent: '#14b8a6',
    gradFrom: '#0c7ff2',
    gradTo: '#14b8a6',
  },
  {
    id: 'energy-coral',
    name: 'Energy Coral',
    vibe: 'fitness · energia',
    bg: '#0d0a10',
    surface: '#1f1824',
    text: '#fff4ee',
    primary: '#ff5e62',
    accent: '#ffd166',
    gradFrom: '#ff5e62',
    gradTo: '#ffd166',
  },
  {
    id: 'forest-calm',
    name: 'Forest Calm',
    vibe: 'bem-estar · educação',
    bg: '#fbf9f4',
    surface: '#ffffff',
    text: '#1a2a1c',
    primary: '#3f8f5a',
    accent: '#b8934b',
    gradFrom: '#3f8f5a',
    gradTo: '#b8934b',
  },
];

const LAYOUT_OPTIONS: Array<{ id: '' | Layout; label: string; desc: string }> = [
  { id: '', label: 'Automático (IA escolhe)', desc: 'Escolhido com base no nicho e tom.' },
  { id: 'vsl-hero', label: 'VSL-first', desc: 'Vídeo gigante no topo + CTA logo abaixo.' },
  { id: 'story-driven', label: 'Story / long-form', desc: 'História → dor → solução → CTA.' },
  { id: 'authority-led', label: 'Authority-led', desc: 'Credenciais + dados em destaque.' },
];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: 'inherit',
  font: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: '#c9cedb',
  fontWeight: 500,
};

const gridTwo: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 12,
};

function splitList(value: string): string[] {
  return value
    .split(/\n|;/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function GenerateWizard({ jobs, onRegister, onOpenJob }: ConsoleProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(EMPTY_WIZARD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const patch = (patchFn: (s: WizardState) => Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patchFn(s) }));

  const canLeaveStep1 = state.prompt.trim().length >= 8 && state.productName.trim().length >= 2;
  const canSubmit = canLeaveStep1 && !busy;

  const handleNext = () => {
    if (step === 0 && !canLeaveStep1) {
      setError('Informe o nome do produto e uma descrição com pelo menos 8 caracteres.');
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const handlePrev = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Complete os campos obrigatórios antes de gerar.');
      setStep(0);
      return;
    }
    const progressTab = window.open('about:blank', '_blank');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        prompt: state.prompt.trim(),
        productName: state.productName.trim() || undefined,
        niche: state.niche.trim() || undefined,
        audience: state.audience.trim() || undefined,
        promise: state.promise.trim() || undefined,
        uniqueMechanism: state.uniqueMechanism.trim() || undefined,
        proofPoints: splitList(state.proofPoints).length
          ? splitList(state.proofPoints)
          : undefined,
        authorName: state.authorName.trim() || undefined,
        authorRole: state.authorRole.trim() || undefined,
        authorBio: state.authorBio.trim() || undefined,
        priceOffer: state.priceOffer.trim() || undefined,
        guarantee: state.guarantee.trim() || undefined,
        cta: state.cta.trim() || undefined,
        bonuses: splitList(state.bonuses).length ? splitList(state.bonuses) : undefined,
        objections: splitList(state.objections).length
          ? splitList(state.objections)
          : undefined,
        urgencyHook: state.urgencyHook.trim() || undefined,
        tone: state.tone,
        language: state.language,
        layoutPreference: state.layoutPreference || undefined,
        palettePreference: state.palettePreference || undefined,
        vslUrl: state.vslUrl.trim() || undefined,
        checkoutUrl: state.checkoutUrl.trim() || undefined,
      };
      const response = await fetch(`${API_BASE}/pages/generate`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        progressTab?.close();
        const body = await response.text();
        throw new Error(body || 'Não foi possível iniciar a geração.');
      }
      const data = (await response.json()) as { jobId: string };
      onRegister({
        id: data.jobId,
        type: 'generate',
        status: 'pending',
        updatedAt: new Date().toISOString(),
      });
      if (progressTab) {
        const url = new URL(window.location.href);
        url.searchParams.set('jobLoading', data.jobId);
        url.searchParams.set('mode', 'generate');
        progressTab.location.href = url.toString();
        setMessage('Geração iniciada — o editor abriu em uma nova aba.');
      } else {
        setMessage('Geração iniciada, mas seu navegador bloqueou o pop-up. Abra pelo job abaixo.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao gerar a página.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="landing-hero">
      <span className="landing-kicker">Gerar · Personalizar · Publicar</span>
      <h1 className="landing-title">
        Sua página de venda <span className="landing-title-gradient">única e profissional</span>
      </h1>
      <p className="landing-subtitle">
        Responda 4 perguntas rápidas. A IA combina copy profundo + design único por cliente
        (layout, paleta, tipografia) e entrega uma página de alta conversão — você só conecta VSL
        e checkout.
      </p>

      <form
        className="clone-card"
        onSubmit={(e) => e.preventDefault()}
        style={{ textAlign: 'left' }}
      >
        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center' }}>
          {STEP_LABELS.map((label, idx) => {
            const isActive = idx === step;
            const isDone = idx < step;
            return (
              <div
                key={label}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    background: isActive
                      ? 'linear-gradient(120deg,#6e5bff,#8777ff)'
                      : isDone
                        ? 'rgba(110,91,255,0.35)'
                        : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: isActive ? '#e9ebf3' : '#8e95a5',
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {label}
                </span>
                {idx < STEP_LABELS.length - 1 ? (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: isDone ? 'rgba(110,91,255,0.4)' : 'rgba(255,255,255,0.08)',
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Step 1 */}
        {step === 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>
              <span>Nome do produto *</span>
              <input
                style={fieldStyle}
                value={state.productName}
                onChange={(e) => patch(() => ({ productName: e.target.value }))}
                placeholder="Método Emagrece Fácil"
                maxLength={120}
                disabled={busy}
                autoFocus
              />
            </label>
            <label style={labelStyle}>
              <span>Descreva o produto *</span>
              <textarea
                style={{ ...fieldStyle, minHeight: 120, resize: 'vertical' }}
                value={state.prompt}
                onChange={(e) => patch(() => ({ prompt: e.target.value }))}
                placeholder="Curso online que ensina mulheres 30+ a perder 5kg em 8 semanas com refeições práticas, sem remédios nem ginástica. Já ajudou +5.000 alunas."
                rows={5}
                maxLength={4000}
                minLength={8}
                disabled={busy}
                required
              />
              <small style={{ color: '#7d8395' }}>
                Quanto mais específico (números, resultados, mecanismo), melhor o copy que a IA entrega.
              </small>
            </label>
            <div style={gridTwo}>
              <label style={labelStyle}>
                <span>Nicho</span>
                <input
                  style={fieldStyle}
                  value={state.niche}
                  onChange={(e) => patch(() => ({ niche: e.target.value }))}
                  placeholder="emagrecimento feminino"
                  maxLength={120}
                  disabled={busy}
                />
              </label>
              <label style={labelStyle}>
                <span>Público-alvo</span>
                <input
                  style={fieldStyle}
                  value={state.audience}
                  onChange={(e) => patch(() => ({ audience: e.target.value }))}
                  placeholder="mulheres 30+ que já tentaram dietas e não funcionou"
                  maxLength={320}
                  disabled={busy}
                />
              </label>
            </div>
            <label style={labelStyle}>
              <span>Grande promessa (uma frase)</span>
              <input
                style={fieldStyle}
                value={state.promise}
                onChange={(e) => patch(() => ({ promise: e.target.value }))}
                placeholder="Perca 5kg em 8 semanas sem passar fome"
                maxLength={280}
                disabled={busy}
              />
            </label>
          </div>
        ) : null}

        {/* Step 2 */}
        {step === 1 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>
              <span>Mecanismo único — por que funciona mesmo se já tentaram de tudo</span>
              <textarea
                style={{ ...fieldStyle, minHeight: 90, resize: 'vertical' }}
                value={state.uniqueMechanism}
                onChange={(e) => patch(() => ({ uniqueMechanism: e.target.value }))}
                placeholder="Método das 3 fases: diagnóstico metabólico, reconstrução alimentar e aceleração. Não é dieta restritiva — é reprogramação."
                rows={3}
                maxLength={600}
                disabled={busy}
              />
            </label>
            <label style={labelStyle}>
              <span>Pontos de prova / credibilidade (um por linha)</span>
              <textarea
                style={{ ...fieldStyle, minHeight: 90, resize: 'vertical' }}
                value={state.proofPoints}
                onChange={(e) => patch(() => ({ proofPoints: e.target.value }))}
                placeholder={'+5.000 alunas formadas\nNutricionista CRN-3 12345\nDestaque na Folha de SP\nEstudo publicado em 2024'}
                rows={4}
                disabled={busy}
              />
            </label>
            <div style={gridTwo}>
              <label style={labelStyle}>
                <span>Nome do autor / mentor</span>
                <input
                  style={fieldStyle}
                  value={state.authorName}
                  onChange={(e) => patch(() => ({ authorName: e.target.value }))}
                  placeholder="Dra. Ana Silva"
                  maxLength={120}
                  disabled={busy}
                />
              </label>
              <label style={labelStyle}>
                <span>Credencial / cargo</span>
                <input
                  style={fieldStyle}
                  value={state.authorRole}
                  onChange={(e) => patch(() => ({ authorRole: e.target.value }))}
                  placeholder="Nutricionista funcional"
                  maxLength={160}
                  disabled={busy}
                />
              </label>
            </div>
            <label style={labelStyle}>
              <span>Mini-bio (2-3 frases)</span>
              <textarea
                style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }}
                value={state.authorBio}
                onChange={(e) => patch(() => ({ authorBio: e.target.value }))}
                placeholder="Mais de 12 anos atendendo mulheres que já tentaram de tudo. Formou mais de 5 mil alunas pelo método desde 2020."
                rows={3}
                maxLength={800}
                disabled={busy}
              />
            </label>
          </div>
        ) : null}

        {/* Step 3 */}
        {step === 2 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={gridTwo}>
              <label style={labelStyle}>
                <span>Preço / linha de oferta</span>
                <input
                  style={fieldStyle}
                  value={state.priceOffer}
                  onChange={(e) => patch(() => ({ priceOffer: e.target.value }))}
                  placeholder="12x de R$ 19,70 · acesso vitalício"
                  maxLength={120}
                  disabled={busy}
                />
              </label>
              <label style={labelStyle}>
                <span>Garantia</span>
                <input
                  style={fieldStyle}
                  value={state.guarantee}
                  onChange={(e) => patch(() => ({ guarantee: e.target.value }))}
                  placeholder="7 dias de garantia incondicional"
                  maxLength={200}
                  disabled={busy}
                />
              </label>
            </div>
            <label style={labelStyle}>
              <span>CTA principal</span>
              <input
                style={fieldStyle}
                value={state.cta}
                onChange={(e) => patch(() => ({ cta: e.target.value }))}
                placeholder="Quero garantir meu acesso"
                maxLength={120}
                disabled={busy}
              />
            </label>
            <label style={labelStyle}>
              <span>Bônus inclusos (um por linha)</span>
              <textarea
                style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }}
                value={state.bonuses}
                onChange={(e) => patch(() => ({ bonuses: e.target.value }))}
                placeholder={'Comunidade privada no WhatsApp\n30 receitas extras\nLive mensal de Q&A'}
                rows={3}
                disabled={busy}
              />
            </label>
            <label style={labelStyle}>
              <span>Objeções do cliente (um por linha — viram FAQ)</span>
              <textarea
                style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }}
                value={state.objections}
                onChange={(e) => patch(() => ({ objections: e.target.value }))}
                placeholder={'Funciona mesmo pra quem já tentou tudo?\nPreciso de academia?\nE se eu não tiver tempo?'}
                rows={3}
                disabled={busy}
              />
            </label>
            <label style={labelStyle}>
              <span>Urgência / escassez (opcional)</span>
              <input
                style={fieldStyle}
                value={state.urgencyHook}
                onChange={(e) => patch(() => ({ urgencyHook: e.target.value }))}
                placeholder="Turma abre só nesta semana"
                maxLength={280}
                disabled={busy}
              />
            </label>
          </div>
        ) : null}

        {/* Step 4 */}
        {step === 3 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={gridTwo}>
              <label style={labelStyle}>
                <span>Tom de voz</span>
                <select
                  style={fieldStyle}
                  value={state.tone}
                  onChange={(e) => patch(() => ({ tone: e.target.value as Tone }))}
                  disabled={busy}
                >
                  <option value="confident">Confiante</option>
                  <option value="friendly">Amigável</option>
                  <option value="urgent">Urgente</option>
                  <option value="empathetic">Empático</option>
                  <option value="authoritative">Autoritário / especialista</option>
                  <option value="playful">Leve / divertido</option>
                </select>
              </label>
              <label style={labelStyle}>
                <span>Idioma</span>
                <select
                  style={fieldStyle}
                  value={state.language}
                  onChange={(e) => patch(() => ({ language: e.target.value as Language }))}
                  disabled={busy}
                >
                  <option value="pt-BR">Português (BR)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </label>
            </div>

            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>
                <span>Layout</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 10,
                }}
              >
                {LAYOUT_OPTIONS.map((opt) => {
                  const active = state.layoutPreference === opt.id;
                  return (
                    <button
                      key={opt.id || 'auto'}
                      type="button"
                      onClick={() => patch(() => ({ layoutPreference: opt.id }))}
                      disabled={busy}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 14,
                        border: `1px solid ${active ? 'rgba(110,91,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
                        background: active
                          ? 'linear-gradient(160deg, rgba(110,91,255,0.18), rgba(110,91,255,0.05))'
                          : 'rgba(255,255,255,0.03)',
                        color: 'inherit',
                        cursor: 'pointer',
                        transition: 'all .15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#8e95a5' }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>
                <span>Paleta de cores</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => patch(() => ({ palettePreference: '' }))}
                  disabled={busy}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: `1px solid ${state.palettePreference === '' ? 'rgba(110,91,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
                    background:
                      state.palettePreference === ''
                        ? 'linear-gradient(160deg, rgba(110,91,255,0.18), rgba(110,91,255,0.05))'
                        : 'rgba(255,255,255,0.03)',
                    color: 'inherit',
                    cursor: 'pointer',
                    minHeight: 108,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>✨ Automático</div>
                  <div style={{ fontSize: 11.5, color: '#8e95a5' }}>
                    A IA escolhe a melhor paleta para o seu nicho e tom.
                  </div>
                </button>
                {PALETTE_SWATCHES.map((p) => {
                  const active = state.palettePreference === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => patch(() => ({ palettePreference: p.id }))}
                      disabled={busy}
                      style={{
                        textAlign: 'left',
                        padding: 0,
                        borderRadius: 14,
                        border: `1px solid ${active ? p.primary : 'rgba(255,255,255,0.08)'}`,
                        boxShadow: active ? `0 0 0 2px ${p.primary}33` : 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'all .15s ease',
                      }}
                    >
                      <div
                        style={{
                          background: p.bg,
                          padding: '12px 14px 10px',
                          borderBottom: `1px solid ${p.primary}22`,
                        }}
                      >
                        {/* Fake hero preview */}
                        <div
                          style={{
                            fontSize: 11,
                            color: p.primary,
                            fontWeight: 700,
                            marginBottom: 4,
                            letterSpacing: 0.2,
                          }}
                        >
                          ● KICKER
                        </div>
                        <div
                          style={{
                            color: p.text,
                            fontWeight: 800,
                            fontSize: 13,
                            lineHeight: 1.2,
                            marginBottom: 6,
                          }}
                        >
                          Headline{' '}
                          <span
                            style={{
                              background: `linear-gradient(120deg, ${p.gradFrom}, ${p.gradTo})`,
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                            }}
                          >
                            destaque
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'inline-block',
                            background: `linear-gradient(120deg, ${p.primary}, ${p.gradTo})`,
                            color: '#fff',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          CTA →
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          background: active
                            ? 'linear-gradient(160deg, rgba(110,91,255,0.15), rgba(110,91,255,0.03))'
                            : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[p.bg, p.surface, p.primary, p.accent].map((c) => (
                              <div
                                key={c}
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 999,
                                  background: c,
                                  border: '1px solid rgba(255,255,255,0.15)',
                                }}
                                title={c}
                              />
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#8e95a5' }}>{p.vibe}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={gridTwo}>
              <label style={labelStyle}>
                <span>URL da VSL (opcional)</span>
                <input
                  style={fieldStyle}
                  value={state.vslUrl}
                  onChange={(e) => patch(() => ({ vslUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/embed/..."
                  maxLength={500}
                  disabled={busy}
                />
              </label>
              <label style={labelStyle}>
                <span>Link do checkout (opcional)</span>
                <input
                  style={fieldStyle}
                  value={state.checkoutUrl}
                  onChange={(e) => patch(() => ({ checkoutUrl: e.target.value }))}
                  placeholder="https://pay.hotmart.com/..."
                  maxLength={500}
                  disabled={busy}
                />
              </label>
            </div>
            <small style={{ color: '#7d8395' }}>
              Pode deixar vazio — a página já sai com slots editáveis pra colar depois.
            </small>
          </div>
        ) : null}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 20,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 0 || busy}
            style={{
              padding: '12px 22px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: '#c9cedb',
              fontWeight: 600,
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.5 : 1,
            }}
          >
            ← Voltar
          </button>
          {step < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="clone-cta"
              disabled={busy || (step === 0 && !canLeaveStep1)}
              style={{ flex: '0 0 auto' }}
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="clone-cta"
              disabled={!canSubmit}
              style={{ flex: '0 0 auto' }}
            >
              {busy ? (
                <>
                  <span className="clone-cta-spinner" />
                  Gerando...
                </>
              ) : (
                <>Gerar minha página →</>
              )}
            </button>
          )}
        </div>

        {error ? <p className="clone-error">{error}</p> : null}
        {message && !error ? <p className="clone-message">{message}</p> : null}
      </form>

      <JobsStream jobs={jobs} onOpen={onOpenJob} />
    </section>
  );
}

/* ----------------------------------------------------------------- */
/*  Root console shell                                                 */
/* ----------------------------------------------------------------- */

interface RootConsoleProps {
  readonly initialMode?: Mode;
  readonly onBack?: () => void;
}

function Console({ initialMode = 'clone', onBack }: RootConsoleProps = {}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const { jobs, register } = useJobsStream();

  const openJob = (jobId: string, jobMode: Mode) => {
    const url = new URL(window.location.href);
    url.searchParams.set('jobLoading', jobId);
    url.searchParams.set('mode', jobMode);
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
            CriaAI <em>{mode === 'clone' ? 'Clone' : 'Create'}</em>
          </span>
        </div>
        <nav className="landing-nav-links" style={{ gap: 8 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#cbd5e1',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ← Minhas páginas
            </button>
          )}
          <div
            role="tablist"
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'clone'}
              onClick={() => setMode('clone')}
              style={tabStyle(mode === 'clone')}
            >
              Clonar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'generate'}
              onClick={() => setMode('generate')}
              style={tabStyle(mode === 'generate')}
            >
              Gerar
            </button>
          </div>
          <span className="landing-nav-pill">Beta</span>
        </nav>
      </header>

      <main className="landing-main">
        {mode === 'clone' ? (
          <CloneConsole jobs={jobs} onRegister={register} onOpenJob={openJob} />
        ) : (
          <GenerateWizard jobs={jobs} onRegister={register} onOpenJob={openJob} />
        )}

        <ul className="landing-features">
          <li>
            <strong>{mode === 'clone' ? 'Render fiel' : 'Copy que converte'}</strong>
            <span>
              {mode === 'clone'
                ? 'Estrutura, tipografia e assets preservados'
                : 'Headline, benefícios e objeções tratados pela IA'}
            </span>
          </li>
          <li>
            <strong>Editor visual</strong>
            <span>Clique em qualquer elemento e edite ao vivo</span>
          </li>
          <li>
            <strong>Slots de VSL e checkout</strong>
            <span>Cole seu player e link do pagamento em 1 clique</span>
          </li>
        </ul>
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

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 18px',
    borderRadius: 999,
    border: 'none',
    background: active
      ? 'linear-gradient(120deg, #6e5bff 0%, #8777ff 100%)'
      : 'transparent',
    color: active ? '#fff' : '#c9cedb',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all .18s ease',
    boxShadow: active ? '0 10px 24px -10px rgba(110,91,255,.6)' : 'none',
  };
}

/**
 * Decides which top-level surface to render once the AuthContext is ready.
 * URL params still drive `?jobLoading=` (active job) and `?pageId=` (open
 * an existing page from the dashboard); everything else falls back to the
 * dashboard for logged users or the auth screen for anonymous visitors.
 */
function AuthGate() {
  const auth = useAuth();
  const [view, setView] = useState<'dashboard' | 'console'>('dashboard');
  const [consoleMode, setConsoleMode] = useState<Mode>('clone');

  if (auth.status === 'loading') {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          Carregando…
        </div>
      </div>
    );
  }

  if (auth.status !== 'authenticated') {
    return <AuthScreen />;
  }

  // URL-based deep links — work both for fresh job loads and direct page
  // edits triggered from the dashboard.
  const params = new URLSearchParams(window.location.search);
  const jobLoading = params.get('jobLoading');
  const pageIdParam = params.get('pageId');
  const modeParam = params.get('mode');
  const mode: Mode = modeParam === 'generate' ? 'generate' : 'clone';

  if (jobLoading) {
    return <JobLoadingScreen jobId={jobLoading} mode={mode} />;
  }
  if (pageIdParam) {
    return <JobLoadingScreen pageId={pageIdParam} mode={mode} />;
  }

  if (view === 'console') {
    return <Console initialMode={consoleMode} onBack={() => setView('dashboard')} />;
  }

  return (
    <DashboardScreen
      onOpenPage={(pageId, openMode) => {
        const url = new URL(window.location.href);
        url.searchParams.set('pageId', pageId);
        url.searchParams.set('mode', openMode);
        window.open(url.toString(), '_blank');
      }}
      onStartNew={(newMode) => {
        setConsoleMode(newMode);
        setView('console');
      }}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
