import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './apiConfig';
import {
  IconAlert,
  IconCart,
  IconCheck,
  IconClose,
  IconCursor,
  IconDesktop,
  IconDownload,
  IconEye,
  IconLink,
  IconMobile,
  IconPage,
  IconPencil,
  IconQuiz,
  IconRocket,
  IconTablet,
  IconUpload,
  IconVideo,
} from './EditorIcons';
import './JobLoadingScreen.css';

type Mode = 'generate' | 'clone';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'blocked';

interface JobRecord {
  id: string;
  type: Mode | 'publish';
  status: JobStatus;
  result?: { pageId?: string; publicUrl?: string };
  error?: string;
  updatedAt: string;
}

interface PageRecord {
  id: string;
  latestVersion?: {
    id: string;
    title: string;
    html: string;
    meta?: unknown;
  };
}

type EditableFieldType = 'text' | 'image' | 'video';

interface EditableField {
  id: string;
  type: EditableFieldType;
  tag: string;
  label: string;
  value: string;
}

interface EditorPage {
  url: string;
  title: string;
  html: string;
  renderMode: 'runtime' | 'frozen';
  stepId?: string;
}

interface PublishState {
  status: 'idle' | 'submitting' | 'processing' | 'done' | 'error';
  jobId?: string;
  publicUrl?: string;
  error?: string;
}

interface CustomizationAnchor {
  id: string;
  stepId: string;
  kind: 'checkout' | 'video';
  selector: string;
  stableId?: string;
  label: string;
  currentValue?: string;
  tag: string;
  provider?: string;
  /**
   * `rewrite-href` | `rewrite-action` | `rewrite-src` | `inject-click` |
   * `replace-embed`. Older versions don't send this — defaults kick in.
   */
  behavior?: string;
}

function extractCustomizationAnchors(meta: unknown): CustomizationAnchor[] {
  if (!meta || typeof meta !== 'object') return [];
  const record = meta as { customizationAnchors?: unknown };
  if (!Array.isArray(record.customizationAnchors)) return [];
  return record.customizationAnchors
    .map((item): CustomizationAnchor | null => {
      if (!item || typeof item !== 'object') return null;
      const c = item as Record<string, unknown>;
      if (
        typeof c.id !== 'string' ||
        typeof c.stepId !== 'string' ||
        (c.kind !== 'checkout' && c.kind !== 'video') ||
        typeof c.selector !== 'string' ||
        typeof c.label !== 'string' ||
        typeof c.tag !== 'string'
      ) {
        return null;
      }
      return {
        id: c.id,
        stepId: c.stepId,
        kind: c.kind,
        selector: c.selector,
        stableId: typeof c.stableId === 'string' ? c.stableId : undefined,
        label: c.label,
        tag: c.tag,
        currentValue:
          typeof c.currentValue === 'string' ? c.currentValue : undefined,
        provider: typeof c.provider === 'string' ? c.provider : undefined,
        behavior: typeof c.behavior === 'string' ? c.behavior : undefined,
      };
    })
    .filter((item): item is CustomizationAnchor => item !== null);
}

interface NavigationEdgeView {
  fromStepId: string;
  toStepId: string;
  selector: string;
  triggerText?: string;
  actionId?: string;
}

function extractNavigationMap(meta: unknown): NavigationEdgeView[] {
  if (!meta || typeof meta !== 'object') return [];
  const record = meta as { navigationMap?: unknown };
  if (!Array.isArray(record.navigationMap)) return [];
  return record.navigationMap
    .map((item): NavigationEdgeView | null => {
      if (!item || typeof item !== 'object') return null;
      const e = item as Record<string, unknown>;
      if (
        typeof e.fromStepId !== 'string' ||
        typeof e.toStepId !== 'string' ||
        typeof e.selector !== 'string'
      ) {
        return null;
      }
      return {
        fromStepId: e.fromStepId,
        toStepId: e.toStepId,
        selector: e.selector,
        triggerText:
          typeof e.triggerText === 'string' ? e.triggerText : undefined,
        actionId: typeof e.actionId === 'string' ? e.actionId : undefined,
      };
    })
    .filter((item): item is NavigationEdgeView => item !== null);
}

function extractCustomizationValues(meta: unknown): Record<string, string> {
  if (!meta || typeof meta !== 'object') return {};
  const record = meta as { customizationValues?: unknown };
  if (!record.customizationValues || typeof record.customizationValues !== 'object') {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(
    record.customizationValues as Record<string, unknown>,
  )) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

const PHRASES_CLONE: string[] = [
  'Mapeando a estrutura da página de origem…',
  'Clonando hierarquia e regiões principais…',
  'Extraindo tipografia e escala visual…',
  'Reconstruindo layout e espaçamentos…',
  'Aplicando estilos e tokens de cor…',
  'Sincronizando assets e mídia…',
  'Ajustando grid e breakpoints…',
  'Validando acessibilidade básica…',
  'Gerando preview editável…',
];

const PHRASES_GENERATE: string[] = [
  'Lendo o briefing e a intenção da campanha…',
  'Definindo hierarquia de seções…',
  'Escrevendo copy orientada a conversão…',
  'Montando hero e prova social…',
  'Aplicando paleta e contraste…',
  'Refinando CTAs e microtextos…',
  'Balanceando ritmo visual e whitespace…',
  'Otimizando para leitura em scan…',
  'Preparando HTML para o editor…',
];

interface Props {
  jobId: string;
  mode: Mode;
}

const MIN_LOADING_MS = 15000;

export function JobLoadingScreen({ jobId, mode }: Props) {
  const phrases = mode === 'clone' ? PHRASES_CLONE : PHRASES_GENERATE;
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [startedAt] = useState(Date.now());
  const [progress, setProgress] = useState(8);
  const [page, setPage] = useState<PageRecord | null>(null);
  const [editorPages, setEditorPages] = useState<EditorPage[]>([]);
  const [activePageUrl, setActivePageUrl] = useState('');
  const [pageError, setPageError] = useState('');
  const [editableHtml, setEditableHtml] = useState('');
  const [editorFields, setEditorFields] = useState<EditableField[]>([]);
  const [selectedEditorId, setSelectedEditorId] = useState('');
  const [editorFilter, setEditorFilter] = useState('');
  const [pageRenderModeOverrides, setPageRenderModeOverrides] = useState<
    Record<string, 'runtime' | 'frozen'>
  >({});
  const [livePreviewHtml, setLivePreviewHtml] = useState('');
  const [saveState, setSaveState] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveError, setSaveError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [publishSubdomain, setPublishSubdomain] = useState('');
  const [publishState, setPublishState] = useState<PublishState>({
    status: 'idle',
  });
  const [exportState, setExportState] = useState<'idle' | 'downloading' | 'error'>(
    'idle',
  );
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>(
    'desktop',
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'content' | 'customize'>(
    'content',
  );
  const [customizationAnchors, setCustomizationAnchors] = useState<
    CustomizationAnchor[]
  >([]);
  const [customizationValues, setCustomizationValues] = useState<
    Record<string, string>
  >({});
  const [navigationMap, setNavigationMap] = useState<NavigationEdgeView[]>([]);
  const customizationDebounceRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const appliedPreviewKeyRef = useRef('');
  const saveDebounceRef = useRef<number | null>(null);
  const pendingDirtyStepsRef = useRef<Set<string>>(new Set());
  const suppressAutosaveOnceRef = useRef(true);

  const title = mode === 'clone' ? 'Clonando interface' : 'Gerando sua landing';
  const kicker = mode === 'clone' ? 'Clone em andamento' : 'Geração em andamento';

  const terminal = useMemo(() => {
    if (!job) {
      return null;
    }
    if (job.status === 'completed') {
      return 'ok' as const;
    }
    if (job.status === 'failed' || job.status === 'blocked') {
      return 'err' as const;
    }
    return null;
  }, [job]);

  const elapsedMs = Math.max(0, clock - startedAt);
  const remainingMs = Math.max(0, MIN_LOADING_MS - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minReady = remainingMs === 0;
  const showLoading = !terminal || !minReady || (terminal === 'ok' && !page && !pageError);

  const selectedField = useMemo(
    () => editorFields.find((field) => field.id === selectedEditorId) ?? null,
    [editorFields, selectedEditorId],
  );
  const activeEditorPage = useMemo(
    () => editorPages.find((item) => item.url === activePageUrl) ?? null,
    [activePageUrl, editorPages],
  );
  const effectiveRenderMode =
    (activePageUrl ? pageRenderModeOverrides[activePageUrl] : undefined) ??
    activeEditorPage?.renderMode ??
    'runtime';

  const filteredEditorFields = useMemo(() => {
    const term = editorFilter.trim().toLowerCase();
    if (!term) {
      return editorFields;
    }
    return editorFields.filter(
      (field) =>
        field.label.toLowerCase().includes(term) ||
        field.type.includes(term) ||
        field.tag.includes(term),
    );
  }, [editorFields, editorFilter]);

  useEffect(() => {
    if (!editableHtml || !activePageUrl) {
      setLivePreviewHtml('');
      appliedPreviewKeyRef.current = '';
      return;
    }
    const key = `${activePageUrl}::${effectiveRenderMode}`;
    if (appliedPreviewKeyRef.current === key && livePreviewHtml) {
      return;
    }
    appliedPreviewKeyRef.current = key;
    setLivePreviewHtml(withEditorBridge(editableHtml, effectiveRenderMode));
  }, [editableHtml, activePageUrl, effectiveRenderMode, livePreviewHtml]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (doneRef.current) {
        return;
      }
      setPhraseIndex((i) => (i + 1) % phrases.length);
    }, 2800);
    return () => window.clearInterval(tick);
  }, [phrases.length]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const pump = window.setInterval(() => {
      if (doneRef.current) {
        return;
      }
      const status = job?.status;
      const cap = status === 'processing' ? 94 : status === 'pending' ? 78 : 88;
      const jitter = Math.random() * 4 + (status === 'processing' ? 3.5 : 1.2);
      setProgress((p) => Math.min(cap, p + jitter));
    }, 420);
    return () => window.clearInterval(pump);
  }, [job?.status]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`);
        if (!response.ok || cancelled) {
          return;
        }
        const data = (await response.json()) as JobRecord;
        setJob(data);
        if (
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.status === 'blocked'
        ) {
          doneRef.current = true;
          setProgress(100);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 1100);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [jobId]);

  useEffect(() => {
    const endpoint = API_BASE.replace(/\/v1$/, '');
    const socket: Socket = io(`${endpoint}/jobs`, { transports: ['websocket'] });
    socket.on('job.updated', (incoming: JobRecord) => {
      if (incoming.id !== jobId) {
        return;
      }
      setJob(incoming);
      if (
        incoming.status === 'completed' ||
        incoming.status === 'failed' ||
        incoming.status === 'blocked'
      ) {
        doneRef.current = true;
        setProgress(100);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  useEffect(() => {
    if (terminal !== 'ok' || !minReady || page || pageError) {
      return;
    }
    const pageId = job?.result?.pageId;
    if (!pageId) {
      setPageError('A missão finalizou sem pageId para abrir o editor.');
      return;
    }
    const loadPage = async () => {
      const response = await fetch(`${API_BASE}/pages/${pageId}`);
      if (!response.ok) {
        throw new Error('Não foi possível carregar a página clonada.');
      }
      setPage((await response.json()) as PageRecord);
    };
    loadPage().catch((error: unknown) => {
      setPageError(error instanceof Error ? error.message : 'Falha ao carregar a página.');
    });
  }, [job, minReady, page, pageError, terminal]);

  // When the generate job finishes, the backend already auto-publishes the
  // page. Reflect that in publishState so the header CTA shows "Republicar"
  // and the share URL is immediately visible in the publish modal.
  useEffect(() => {
    if (job?.status !== 'completed') return;
    const url = job?.result?.publicUrl;
    if (!url) return;
    setPublishState((prev) =>
      prev.status === 'done' && prev.publicUrl === url
        ? prev
        : { status: 'done', publicUrl: url },
    );
  }, [job?.status, job?.result?.publicUrl]);

  useEffect(() => {
    const sourceHtml = page?.latestVersion?.html;
    if (!sourceHtml) {
      return;
    }
    const fromMeta = extractPublicPagesFromMeta(page.latestVersion?.meta);
    const resolvedPages =
      fromMeta.length > 0
        ? fromMeta
        : [
            {
              url: `page://${page.id}`,
              title: page.latestVersion?.title ?? 'Página principal',
              html: sourceHtml,
              renderMode: 'runtime' as const,
            },
          ];
    setEditorPages(resolvedPages);
    setActivePageUrl(resolvedPages[0]?.url ?? '');
    setCustomizationAnchors(
      extractCustomizationAnchors(page?.latestVersion?.meta),
    );
    setCustomizationValues(
      extractCustomizationValues(page?.latestVersion?.meta),
    );
    setNavigationMap(extractNavigationMap(page?.latestVersion?.meta));
    suppressAutosaveOnceRef.current = true;
    pendingDirtyStepsRef.current.clear();
    setSaveState('idle');
    setSaveError('');
  }, [page?.id, page?.latestVersion?.html, page?.latestVersion?.meta, page?.latestVersion?.title]);

  useEffect(() => {
    if (!page?.id || !editorPages.length) return;
    if (suppressAutosaveOnceRef.current) {
      suppressAutosaveOnceRef.current = false;
      return;
    }
    if (activePageUrl) {
      const active = editorPages.find((p) => p.url === activePageUrl);
      const key = active?.stepId ?? active?.url ?? activePageUrl;
      pendingDirtyStepsRef.current.add(key);
      setSaveState('pending');
    }
    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
    }
    saveDebounceRef.current = window.setTimeout(() => {
      void (async () => {
        if (!page?.id) return;
        setSaveState('saving');
        try {
          const dirty = Array.from(pendingDirtyStepsRef.current);
          pendingDirtyStepsRef.current.clear();
          const steps = editorPages
            .filter((p) =>
              dirty.includes(p.stepId ?? p.url) && Boolean(p.stepId ?? 'main'),
            )
            .map((p) => ({
              stepId: p.stepId ?? 'main',
              html: p.html,
              title: p.title,
              renderMode: p.renderMode,
            }));
          const mainEntry = editorPages.find(
            (p) => (p.stepId ?? 'main') === 'main',
          );
          const body: Record<string, unknown> = {};
          if (steps.length) body.steps = steps;
          if (mainEntry && dirty.includes(mainEntry.stepId ?? mainEntry.url)) {
            body.mainHtml = mainEntry.html;
            body.title = mainEntry.title;
          }
          if (!body.steps && !body.mainHtml) {
            setSaveState('saved');
            return;
          }
          const res = await fetch(`${API_BASE}/pages/${page.id}/content`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
          }
          const json = (await res.json()) as { updatedAt?: string };
          setLastSavedAt(json.updatedAt ?? new Date().toISOString());
          setSaveState('saved');
          setSaveError('');
        } catch (err) {
          setSaveState('error');
          setSaveError(
            err instanceof Error ? err.message : 'Falha ao salvar',
          );
        }
      })();
    }, 1600);
    return () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
      }
    };
  }, [editorPages, activePageUrl, page?.id]);

  const handlePublish = useCallback(async () => {
    if (!page?.id) return;
    const subdomain = publishSubdomain.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(subdomain)) {
      setPublishState({
        status: 'error',
        error: 'Subdomínio inválido: use letras minúsculas, números e hífen.',
      });
      return;
    }
    setPublishState({ status: 'submitting' });
    try {
      const res = await fetch(`${API_BASE}/pages/${page.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
      }
      const data = (await res.json()) as { jobId: string };
      setPublishState({ status: 'processing', jobId: data.jobId });
      const pollStart = Date.now();
      const poll = async (): Promise<void> => {
        if (Date.now() - pollStart > 60000) {
          setPublishState({
            status: 'error',
            error: 'Publicação demorou demais. Tente novamente.',
          });
          return;
        }
        const jobRes = await fetch(`${API_BASE}/jobs/${data.jobId}`);
        const job = (await jobRes.json()) as {
          status?: string;
          result?: { publicUrl?: string };
          error?: string;
        };
        if (job.status === 'completed') {
          setPublishState({
            status: 'done',
            jobId: data.jobId,
            publicUrl: job.result?.publicUrl,
          });
          return;
        }
        if (job.status === 'failed') {
          setPublishState({
            status: 'error',
            error: job.error ?? 'Falha desconhecida',
          });
          return;
        }
        setTimeout(() => void poll(), 1500);
      };
      void poll();
    } catch (err) {
      setPublishState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Falha ao publicar',
      });
    }
  }, [page?.id, publishSubdomain]);

  const applyCustomizationToIframe = useCallback(
    (
      anchorsForPage: CustomizationAnchor[],
      values: Record<string, string>,
    ) => {
      const frame = iframeRef.current;
      if (!frame?.contentWindow) return;
      frame.contentWindow.postMessage(
        {
          type: 'editor.applyCustomizations',
          items: anchorsForPage.map((a) => ({
            id: a.id,
            kind: a.kind,
            tag: a.tag,
            selector: a.selector,
            stableId: a.stableId,
            behavior: a.behavior,
            label: a.label,
            value: values[a.id] ?? '',
          })),
        },
        '*',
      );
    },
    [],
  );

  const activeStepId = useMemo(() => {
    if (!activePageUrl) return 'main';
    const found = editorPages.find((p) => p.url === activePageUrl);
    return found?.stepId ?? 'main';
  }, [activePageUrl, editorPages]);

  const anchorsForActiveStep = useMemo(
    () =>
      customizationAnchors.filter((a) => a.stepId === activeStepId),
    [customizationAnchors, activeStepId],
  );

  const navItemsForActiveStep = useMemo(
    () =>
      navigationMap
        .filter((edge) => edge.fromStepId === activeStepId)
        .map((edge) => {
          const target = editorPages.find((p) => p.stepId === edge.toStepId);
          const friendly =
            target?.title?.split('·').pop()?.trim() ||
            edge.toStepId.toUpperCase();
          return {
            selector: edge.selector,
            actionId: edge.actionId,
            label: friendly.length > 22 ? `${friendly.slice(0, 22)}…` : friendly,
            stepId: edge.toStepId,
            triggerText: edge.triggerText,
          };
        }),
    [navigationMap, activeStepId, editorPages],
  );

  const sendNavigationToIframe = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage(
      { type: 'editor.markNavigation', items: navItemsForActiveStep },
      '*',
    );
  }, [navItemsForActiveStep]);

  useEffect(() => {
    if (!anchorsForActiveStep.length) return;
    const t = window.setTimeout(() => {
      applyCustomizationToIframe(anchorsForActiveStep, customizationValues);
    }, 120);
    return () => window.clearTimeout(t);
  }, [
    anchorsForActiveStep,
    customizationValues,
    livePreviewHtml,
    applyCustomizationToIframe,
  ]);

  useEffect(() => {
    const t = window.setTimeout(sendNavigationToIframe, 140);
    return () => window.clearTimeout(t);
  }, [sendNavigationToIframe, livePreviewHtml]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = (event.data ?? {}) as { type?: string; stepId?: string };
      if (data.type === 'editor.ready') {
        sendNavigationToIframe();
        if (anchorsForActiveStep.length) {
          applyCustomizationToIframe(anchorsForActiveStep, customizationValues);
        }
        return;
      }
      if (data.type === 'editor.navigateTo' && typeof data.stepId === 'string') {
        const target = editorPages.find((p) => p.stepId === data.stepId);
        if (target) {
          setActivePageUrl(target.url);
        }
        return;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [
    sendNavigationToIframe,
    anchorsForActiveStep,
    customizationValues,
    applyCustomizationToIframe,
    editorPages,
  ]);

  const handleCustomizationChange = useCallback(
    (anchorId: string, value: string) => {
      setCustomizationValues((current) => ({ ...current, [anchorId]: value }));
      if (customizationDebounceRef.current) {
        window.clearTimeout(customizationDebounceRef.current);
      }
      customizationDebounceRef.current = window.setTimeout(() => {
        void (async () => {
          if (!page?.id) return;
          try {
            setSaveState('saving');
            const res = await fetch(
              `${API_BASE}/pages/${page.id}/content`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customizationValues: { [anchorId]: value },
                }),
              },
            );
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            const json = (await res.json()) as { updatedAt?: string };
            setLastSavedAt(json.updatedAt ?? new Date().toISOString());
            setSaveState('saved');
            setSaveError('');
          } catch (err) {
            setSaveState('error');
            setSaveError(
              err instanceof Error ? err.message : 'Falha ao salvar',
            );
          }
        })();
      }, 900);
    },
    [page?.id],
  );

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage(
      { type: 'editor.setMode', preview: previewMode },
      '*',
    );
  }, [previewMode, livePreviewHtml]);

  const totalCheckouts = useMemo(
    () => customizationAnchors.filter((a) => a.kind === 'checkout').length,
    [customizationAnchors],
  );
  const totalVideos = useMemo(
    () => customizationAnchors.filter((a) => a.kind === 'video').length,
    [customizationAnchors],
  );
  const pendingCustomizations = useMemo(
    () =>
      customizationAnchors.filter(
        (a) => !customizationValues[a.id]?.trim(),
      ).length,
    [customizationAnchors, customizationValues],
  );

  const handleExportZip = useCallback(async () => {
    if (!page?.id) return;
    setExportState('downloading');
    try {
      const res = await fetch(
        `${API_BASE}/pages/${page.id}/export.zip`,
        { method: 'GET' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `criaai-page-${page.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportState('idle');
    } catch (err) {
      setExportState('error');
      console.error('[export]', err);
    }
  }, [page?.id]);

  useEffect(() => {
    if (!activeEditorPage?.html) {
      return;
    }
    const htmlWithIds = ensureEditorIds(activeEditorPage.html);
    setEditableHtml(htmlWithIds);
    const fields = extractEditableFields(htmlWithIds);
    setEditorFields(fields);
    setSelectedEditorId((current) =>
      fields.some((item) => item.id === current) ? current : fields[0]?.id ?? '',
    );
  }, [activePageUrl]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        id?: string;
        value?: string;
      };
      if (!data || typeof data.id !== 'string') {
        return;
      }
      if (data.type === 'editor.select') {
        setSelectedEditorId(data.id);
        setInspectorTab('content');
        return;
      }
      if (data.type === 'editor.text') {
        const value = data.value ?? '';
        const targetId = data.id;
        setEditorFields((current) =>
          current.map((f) => (f.id === targetId ? { ...f, value } : f)),
        );
        setEditableHtml((current) => {
          if (!current) return current;
          const doc = new DOMParser().parseFromString(current, 'text/html');
          const target = doc.querySelector<HTMLElement>(
            `[data-editor-id="${targetId}"]`,
          );
          if (target) target.textContent = value;
          return doc.documentElement.outerHTML;
        });
        setEditorPages((current) =>
          current.map((item) => {
            if (item.url !== activePageUrl) return item;
            const doc = new DOMParser().parseFromString(item.html, 'text/html');
            const target = doc.querySelector<HTMLElement>(
              `[data-editor-id="${targetId}"]`,
            );
            if (target) target.textContent = value;
            return { ...item, html: doc.documentElement.outerHTML };
          }),
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activePageUrl]);

  useEffect(() => {
    if (!selectedEditorId) {
      return;
    }
    const frame = iframeRef.current;
    if (!frame?.contentWindow) {
      return;
    }
    frame.contentWindow.postMessage(
      { type: 'editor.highlight', id: selectedEditorId },
      '*',
    );
  }, [selectedEditorId, livePreviewHtml]);

  const statusLabel = job?.status ?? 'pending';

  const onEditorValueChange = (nextValue: string) => {
    if (!selectedField) {
      return;
    }
    const fieldId = selectedField.id;
    const nextField: EditableField = { ...selectedField, value: nextValue };
    const nextHtml = applyFieldUpdate(editableHtml, nextField);
    setEditableHtml(nextHtml);
    setEditorFields((current) =>
      current.map((f) => (f.id === fieldId ? { ...f, value: nextValue } : f)),
    );
    setEditorPages((current) =>
      current.map((item) =>
        item.url === activePageUrl ? { ...item, html: nextHtml } : item,
      ),
    );
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage(
        {
          type: 'editor.set',
          id: fieldId,
          kind: selectedField.type === 'text' ? 'text' : 'src',
          value: nextValue,
        },
        '*',
      );
    }
  };

  const onImageUpload = async (file: File) => {
    if (!selectedField || selectedField.type !== 'image') {
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    onEditorValueChange(dataUrl);
  };

  return (
    <div className="job-loading-root">
      {showLoading ? (
        <div className="job-loading-card">
          <p className="job-loading-kicker">{kicker}</p>
          <h1 className="job-loading-title">{title}</h1>
          <p className="job-loading-sub">
            Preparando editor da missão. Tempo mínimo de loading: 15 segundos.
          </p>
          <div className="job-loading-phrase">
            <p key={phraseIndex}>{phrases[phraseIndex]}</p>
          </div>
          <div className="job-loading-bar-wrap">
            <div
              className="job-loading-bar"
              style={{ width: `${Math.max(Math.round(progress), Math.round((elapsedMs / MIN_LOADING_MS) * 100))}%` }}
            />
          </div>
          <div className="job-loading-meta">
            <span>
              Estado: <strong>{statusLabel}</strong>
            </span>
            <span>{remainingMs > 0 ? `faltam ${remainingSeconds}s` : 'finalizando...'}</span>
          </div>
          <p className="job-loading-id">Job ID · {jobId}</p>
        </div>
      ) : terminal === 'err' ? (
        <div className="job-loading-card">
          <p className="job-loading-kicker">Falha na missão</p>
          <div className="job-loading-status err">
            {job?.error?.trim()
              ? job.error
              : 'Não foi possível concluir esta missão. Verifique os logs no backend.'}
          </div>
        </div>
      ) : pageError ? (
        <div className="job-loading-card">
          <p className="job-loading-kicker">Erro ao abrir editor</p>
          <div className="job-loading-status err">{pageError}</div>
        </div>
      ) : (
        <section className={`editor-shell device-${device}${previewMode ? ' is-preview' : ''}`}>
          <header className="editor-topbar">
            <div className="editor-topbar-left">
              <a
                className="editor-brand"
                href={window.location.pathname}
                title="Voltar ao console"
              >
                <span className="editor-brand-mark">C</span>
                <span className="editor-brand-text">CriaAI</span>
              </a>
              <div className="editor-project">
                <span className="editor-project-title">
                  {page?.latestVersion?.title ?? 'Página clonada'}
                </span>
                <span
                  className={`editor-save-indicator state-${saveState}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="editor-save-dot" />
                  {saveState === 'saving' && 'Salvando…'}
                  {saveState === 'pending' && 'Alterações pendentes'}
                  {saveState === 'saved' &&
                    (lastSavedAt
                      ? `Salvo ${new Date(lastSavedAt).toLocaleTimeString(
                          [],
                          { hour: '2-digit', minute: '2-digit' },
                        )}`
                      : 'Salvo')}
                  {saveState === 'idle' && !lastSavedAt && 'Pronto'}
                  {saveState === 'error' && (
                    <span title={saveError}>Erro ao salvar</span>
                  )}
                </span>
              </div>
            </div>

            <div className="editor-topbar-center">
              <div className="editor-device-group" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={device === 'desktop'}
                  className={device === 'desktop' ? 'active' : ''}
                  onClick={() => setDevice('desktop')}
                  title="Desktop (1280px)"
                >
                  <IconDesktop />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={device === 'tablet'}
                  className={device === 'tablet' ? 'active' : ''}
                  onClick={() => setDevice('tablet')}
                  title="Tablet (768px)"
                >
                  <IconTablet />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={device === 'mobile'}
                  className={device === 'mobile' ? 'active' : ''}
                  onClick={() => setDevice('mobile')}
                  title="Mobile (390px)"
                >
                  <IconMobile />
                </button>
              </div>
              <button
                type="button"
                className={`editor-iconbtn ${
                  previewMode ? 'is-on' : ''
                }`}
                onClick={() => setPreviewMode((v) => !v)}
                title={previewMode ? 'Sair da visualização' : 'Visualizar'}
              >
                <IconEye />
                <span>{previewMode ? 'Editar' : 'Visualizar'}</span>
              </button>
            </div>

            <div className="editor-topbar-right">
              {publishState.status === 'done' && publishState.publicUrl ? (
                <a
                  href={publishState.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="editor-btn editor-btn-ghost"
                  title={`Abrir ${publishState.publicUrl}`}
                  style={{
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                  }}
                >
                  <IconCheck />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {publishState.publicUrl.replace(/^https?:\/\//, '')}
                  </span>
                </a>
              ) : null}
              <button
                type="button"
                className="editor-btn editor-btn-ghost"
                onClick={handleExportZip}
                disabled={exportState === 'downloading'}
              >
                <IconDownload />
                <span>
                  {exportState === 'downloading' ? 'Gerando…' : 'Baixar ZIP'}
                </span>
              </button>
              <button
                type="button"
                className="editor-btn editor-btn-primary"
                onClick={() => setPublishModalOpen(true)}
              >
                {publishState.status === 'done' ? (
                  <>
                    <IconCheck />
                    <span>Republicar</span>
                  </>
                ) : (
                  <>
                    <IconRocket />
                    <span>Publicar</span>
                  </>
                )}
              </button>
            </div>
          </header>

          <div className="editor-body">
            <aside className="editor-sidebar">
              <div className="editor-sidebar-head">
                <h4>Páginas</h4>
                <span className="editor-sidebar-count">
                  {editorPages.length}
                </span>
              </div>
              <div className="editor-pages-list">
                {editorPages.map((item, index) => {
                  const itemStepId = item.stepId ?? 'main';
                  const itemAnchors = customizationAnchors.filter(
                    (a) => a.stepId === itemStepId,
                  );
                  const pendingForItem = itemAnchors.filter(
                    (a) => !customizationValues[a.id]?.trim(),
                  ).length;
                  const isQuiz = itemStepId.startsWith('v');
                  const isActive = item.url === activePageUrl;
                  return (
                    <button
                      key={item.url}
                      type="button"
                      className={`editor-page-item${
                        isActive ? ' active' : ''
                      }`}
                      onClick={() => setActivePageUrl(item.url)}
                    >
                      <span className="editor-page-icon">
                        {isQuiz ? <IconQuiz /> : <IconPage />}
                      </span>
                      <span className="editor-page-meta">
                        <span className="editor-page-title">
                          {itemStepId === 'main'
                            ? 'Página principal'
                            : `${itemStepId.toUpperCase()}`}
                        </span>
                        <span className="editor-page-sub">
                          {item.title.length > 32
                            ? item.title.slice(0, 32) + '…'
                            : item.title || `Step ${index + 1}`}
                        </span>
                      </span>
                      {pendingForItem > 0 && (
                        <span
                          className="editor-page-badge"
                          title={`${pendingForItem} customização(ões) pendente(s)`}
                        >
                          {pendingForItem}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="editor-sidebar-foot">
                <div className="editor-render-mode">
                  <label>Render</label>
                  <div className="editor-render-toggle">
                    <button
                      type="button"
                      className={
                        effectiveRenderMode === 'runtime' ? 'active' : ''
                      }
                      onClick={() => {
                        if (!activePageUrl) return;
                        setPageRenderModeOverrides((current) => ({
                          ...current,
                          [activePageUrl]: 'runtime',
                        }));
                      }}
                      title="Mantém scripts originais (maior fidelidade)"
                    >
                      Runtime
                    </button>
                    <button
                      type="button"
                      className={
                        effectiveRenderMode === 'frozen' ? 'active' : ''
                      }
                      onClick={() => {
                        if (!activePageUrl) return;
                        setPageRenderModeOverrides((current) => ({
                          ...current,
                          [activePageUrl]: 'frozen',
                        }));
                      }}
                      title="Remove scripts (mais estável pra edição)"
                    >
                      Frozen
                    </button>
                  </div>
                </div>
                {pendingCustomizations > 0 && (
                  <p className="editor-sidebar-hint">
                    {pendingCustomizations}{' '}
                    {pendingCustomizations === 1
                      ? 'personalização pendente'
                      : 'personalizações pendentes'}
                  </p>
                )}
              </div>
            </aside>

            <main className="editor-canvas" aria-label="Preview da página">
              <div className="editor-canvas-surface">
                <div className="editor-frame-wrap">
                  {livePreviewHtml ? (
                    <iframe
                      ref={iframeRef}
                      className="editor-frame"
                      title="Cloned page editor"
                      srcDoc={livePreviewHtml}
                      sandbox={
                        effectiveRenderMode === 'frozen'
                          ? 'allow-scripts allow-forms allow-modals allow-popups allow-downloads'
                          : 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation-by-user-activation'
                      }
                    />
                  ) : (
                    <div className="editor-frame-empty">
                      Editor sem conteúdo carregado.
                    </div>
                  )}
                </div>
              </div>
            </main>

            <aside className="editor-inspector">
              <div className="editor-inspector-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === 'content'}
                  className={inspectorTab === 'content' ? 'active' : ''}
                  onClick={() => setInspectorTab('content')}
                >
                  <IconPencil />
                  <span>Conteúdo</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === 'customize'}
                  className={inspectorTab === 'customize' ? 'active' : ''}
                  onClick={() => setInspectorTab('customize')}
                >
                  <IconLink />
                  <span>Personalizar</span>
                  {anchorsForActiveStep.length > 0 && (
                    <span className="editor-inspector-badge">
                      {anchorsForActiveStep.length}
                    </span>
                  )}
                </button>
              </div>

              {inspectorTab === 'content' && (
                <div className="editor-inspector-body">
                  {selectedField ? (
                    <>
                      <div className="editor-inspector-header">
                        <span className="editor-inspector-tag">
                          {selectedField.tag.toUpperCase()}
                        </span>
                        <span className="editor-inspector-title">
                          {selectedField.label}
                        </span>
                      </div>
                      <label className="editor-field">
                        <span>
                          {selectedField.type === 'text'
                            ? 'Texto'
                            : 'URL de mídia'}
                        </span>
                        {selectedField.type === 'text' ? (
                          <textarea
                            value={selectedField.value}
                            onChange={(event) =>
                              onEditorValueChange(event.target.value)
                            }
                            rows={6}
                          />
                        ) : (
                          <input
                            type="url"
                            value={selectedField.value}
                            onChange={(event) =>
                              onEditorValueChange(event.target.value)
                            }
                          />
                        )}
                      </label>
                      {selectedField.type === 'image' && (
                        <label className="editor-field editor-field-file">
                          <span>Substituir imagem</span>
                          <div className="editor-file-drop">
                            <IconUpload />
                            <span>Arraste uma imagem ou clique</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  void onImageUpload(file);
                                }
                              }}
                            />
                          </div>
                        </label>
                      )}
                    </>
                  ) : (
                    <div className="editor-inspector-empty">
                      <div className="editor-inspector-empty-icon">
                        <IconCursor />
                      </div>
                      <h5>Clique em qualquer elemento</h5>
                      <p>
                        Selecione um título, parágrafo, botão ou imagem no
                        preview para editar seu conteúdo aqui.
                      </p>
                      {editorFields.length > 0 && (
                        <details className="editor-inspector-outline">
                          <summary>
                            ou procure na lista ({editorFields.length})
                          </summary>
                          <input
                            placeholder="Filtrar…"
                            value={editorFilter}
                            onChange={(event) =>
                              setEditorFilter(event.target.value)
                            }
                          />
                          <div className="editor-outline-list">
                            {filteredEditorFields.slice(0, 60).map((field) => (
                              <button
                                key={field.id}
                                type="button"
                                onClick={() => setSelectedEditorId(field.id)}
                                className={
                                  field.id === selectedEditorId ? 'active' : ''
                                }
                              >
                                <span className="tag">
                                  {field.type === 'image' ? 'IMG' : field.tag}
                                </span>
                                <span className="label">{field.label}</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'customize' && (
                <div className="editor-inspector-body">
                  {anchorsForActiveStep.length === 0 ? (
                    <div className="editor-inspector-empty">
                      <div className="editor-inspector-empty-icon">
                        <IconLink />
                      </div>
                      <h5>Nada a personalizar aqui</h5>
                      <p>
                        Não detectamos checkouts ou VSLs nesta página.
                        {totalCheckouts + totalVideos > 0
                          ? ' Mas há customizações em outras páginas da sua clonagem.'
                          : ''}
                      </p>
                    </div>
                  ) : (
                    <>
                      {anchorsForActiveStep.some(
                        (a) => a.kind === 'checkout',
                      ) && (
                        <div className="editor-custom-group">
                          <div className="editor-custom-group-head">
                            <IconCart />
                            <div>
                              <h5>Checkouts</h5>
                              <span>
                                {
                                  anchorsForActiveStep.filter(
                                    (a) => a.kind === 'checkout',
                                  ).length
                                }{' '}
                                botão(ões) detectado(s)
                              </span>
                            </div>
                          </div>
                          {anchorsForActiveStep
                            .filter((a) => a.kind === 'checkout')
                            .map((anchor) => (
                              <div
                                key={anchor.id}
                                className="editor-custom-card"
                              >
                                <div className="editor-custom-card-top">
                                  <span className="editor-custom-label">
                                    {anchor.label}
                                  </span>
                                  {anchor.provider && (
                                    <span className="editor-custom-provider">
                                      {anchor.provider}
                                    </span>
                                  )}
                                </div>
                                {anchor.currentValue && (
                                  <span className="editor-custom-current">
                                    atual: {anchor.currentValue.slice(0, 60)}
                                    {anchor.currentValue.length > 60
                                      ? '…'
                                      : ''}
                                  </span>
                                )}
                                <input
                                  type="url"
                                  placeholder="https://pay.suamarca.com/..."
                                  value={customizationValues[anchor.id] ?? ''}
                                  onChange={(e) =>
                                    handleCustomizationChange(
                                      anchor.id,
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            ))}
                        </div>
                      )}
                      {anchorsForActiveStep.some(
                        (a) => a.kind === 'video',
                      ) && (
                        <div className="editor-custom-group">
                          <div className="editor-custom-group-head">
                            <IconVideo />
                            <div>
                              <h5>VSLs / Vídeos</h5>
                              <span>
                                {
                                  anchorsForActiveStep.filter(
                                    (a) => a.kind === 'video',
                                  ).length
                                }{' '}
                                player(s) detectado(s)
                              </span>
                            </div>
                          </div>
                          {anchorsForActiveStep
                            .filter((a) => a.kind === 'video')
                            .map((anchor) => (
                              <div
                                key={anchor.id}
                                className="editor-custom-card"
                              >
                                <div className="editor-custom-card-top">
                                  <span className="editor-custom-label">
                                    {anchor.label}
                                  </span>
                                  {anchor.provider && (
                                    <span className="editor-custom-provider">
                                      {anchor.provider}
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="url"
                                  placeholder="https://player.vimeo.com/video/..."
                                  value={customizationValues[anchor.id] ?? ''}
                                  onChange={(e) =>
                                    handleCustomizationChange(
                                      anchor.id,
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </aside>
          </div>

          {publishModalOpen && (
            <div
              className="editor-modal-backdrop"
              onClick={() => setPublishModalOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="editor-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="editor-modal-head">
                  <div>
                    <h3>Publicar página</h3>
                    <p>
                      Gere uma URL navegável com todas as variantes do quiz,
                      links reescritos e customizações aplicadas.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="editor-modal-close"
                    onClick={() => setPublishModalOpen(false)}
                    aria-label="Fechar"
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="editor-modal-body">
                  <label className="editor-field">
                    <span>Subdomínio</span>
                    <div className="editor-publish-input">
                      <input
                        type="text"
                        placeholder="minha-pagina"
                        value={publishSubdomain}
                        onChange={(e) =>
                          setPublishSubdomain(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ''),
                          )
                        }
                        disabled={
                          publishState.status === 'submitting' ||
                          publishState.status === 'processing'
                        }
                      />
                      <span>.criaai.app</span>
                    </div>
                  </label>
                  {pendingCustomizations > 0 && (
                    <div className="editor-modal-warn">
                      <IconAlert />
                      <div>
                        <strong>
                          {pendingCustomizations}{' '}
                          {pendingCustomizations === 1
                            ? 'customização pendente'
                            : 'customizações pendentes'}
                        </strong>
                        <p>
                          Você pode publicar mesmo assim — o conteúdo original
                          será mantido onde não preencheu.
                        </p>
                      </div>
                    </div>
                  )}
                  {publishState.status === 'error' && (
                    <p className="editor-modal-error">{publishState.error}</p>
                  )}
                  {publishState.status === 'done' &&
                    publishState.publicUrl && (
                      <div className="editor-modal-success">
                        <IconCheck />
                        <div>
                          <strong>Publicado com sucesso</strong>
                          <a
                            href={publishState.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {publishState.publicUrl}
                          </a>
                        </div>
                      </div>
                    )}
                </div>
                <div className="editor-modal-foot">
                  <button
                    type="button"
                    className="editor-btn editor-btn-ghost"
                    onClick={() => setPublishModalOpen(false)}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="editor-btn editor-btn-primary"
                    onClick={handlePublish}
                    disabled={
                      !publishSubdomain ||
                      publishState.status === 'submitting' ||
                      publishState.status === 'processing'
                    }
                  >
                    {publishState.status === 'submitting' && 'Enviando…'}
                    {publishState.status === 'processing' && 'Publicando…'}
                    {(publishState.status === 'idle' ||
                      publishState.status === 'error') &&
                      'Publicar agora'}
                    {publishState.status === 'done' && 'Republicar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function extractPublicPagesFromMeta(meta: unknown): EditorPage[] {
  if (!meta || typeof meta !== 'object') {
    return [];
  }
  const record = meta as { publicPages?: unknown };
  if (!Array.isArray(record.publicPages)) {
    return [];
  }
  return record.publicPages
    .map((item): EditorPage | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const candidate = item as {
        url?: unknown;
        title?: unknown;
        html?: unknown;
        renderMode?: unknown;
        stepId?: unknown;
      };
      if (
        typeof candidate.url !== 'string' ||
        typeof candidate.title !== 'string' ||
        typeof candidate.html !== 'string'
      ) {
        return null;
      }
      return {
        url: candidate.url,
        title: candidate.title,
        html: candidate.html,
        renderMode:
          candidate.renderMode === 'frozen' ? 'frozen' : 'runtime',
        stepId:
          typeof candidate.stepId === 'string' ? candidate.stepId : undefined,
      };
    })
    .filter((item): item is EditorPage => item !== null);
}

function ensureEditorIds(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const candidates = doc.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,span,li,a,button,label,strong,em,small,blockquote,img,video,iframe',
  );
  let cursor = 0;
  candidates.forEach((el) => {
    const element = el as HTMLElement;
    if (element.dataset.editorId) return;
    // Prefer the already-injected stable id (data-criaai-id) so editor refs
    // stay stable across walker re-runs and per-step navigations.
    const stable = element.getAttribute('data-criaai-id');
    if (stable) {
      element.dataset.editorId = stable;
    } else {
      cursor += 1;
      element.dataset.editorId = `ed-${cursor}`;
    }
  });
  return doc.documentElement.outerHTML;
}

function snippetLabel(tag: string, text: string, index: number): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return `${tag.toUpperCase()} ${index + 1}`;
  }
  const slice = trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
  return `${tag.toUpperCase()}: ${slice}`;
}

function extractEditableFields(html: string): EditableField[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = doc.querySelectorAll<HTMLElement>('[data-editor-id]');
  return [...nodes]
    .map((node, index) => {
      const id = node.dataset.editorId;
      if (!id) {
        return null;
      }
      const tag = node.tagName.toLowerCase();
      if (tag === 'img') {
        const src = (node as HTMLImageElement).getAttribute('src') ?? '';
        const alt = (node as HTMLImageElement).getAttribute('alt') ?? '';
        return {
          id,
          type: 'image' as const,
          tag,
          label: alt ? `IMG: ${alt.slice(0, 40)}` : `Image ${index + 1}`,
          value: src,
        };
      }
      if (tag === 'video' || tag === 'iframe') {
        return {
          id,
          type: 'video' as const,
          tag,
          label: `${tag.toUpperCase()} ${index + 1}`,
          value: node.getAttribute('src') ?? '',
        };
      }
      const text = node.textContent?.trim() ?? '';
      if (!text) {
        return null;
      }
      return {
        id,
        type: 'text' as const,
        tag,
        label: snippetLabel(tag, text, index),
        value: text,
      };
    })
    .filter((item): item is EditableField => item !== null);
}

function applyFieldUpdate(html: string, field: EditableField): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const target = doc.querySelector<HTMLElement>(`[data-editor-id="${field.id}"]`);
  if (!target) {
    return html;
  }
  if (field.type === 'text') {
    target.textContent = field.value;
  } else {
    target.setAttribute('src', field.value);
  }
  return doc.documentElement.outerHTML;
}

const EDITOR_BRIDGE_CSS = `
  html[data-criaai-mode="edit"] [data-editor-id] { transition: outline-color 120ms ease, box-shadow 120ms ease; }
  html[data-criaai-mode="edit"] [data-editor-id]:hover { outline: 2px dashed rgba(124,92,255,0.75) !important; outline-offset: 2px !important; cursor: pointer !important; }
  html[data-criaai-mode="edit"] [data-editor-id][data-editor-selected] { outline: 2px solid rgba(124,92,255,0.95) !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px rgba(124,92,255,0.18) !important; }
  html[data-criaai-mode="edit"] [data-editor-id][contenteditable="true"] { cursor: text !important; caret-color: rgba(124,92,255,0.95); }
  html, body { -webkit-user-select: text; user-select: text; }
  html[data-criaai-mode="preview"] [data-editor-id] { outline: none !important; box-shadow: none !important; }
  /* Navigation badges over quiz buttons */
  html[data-criaai-mode="edit"] [data-criaai-nav] {
    position: relative !important;
    outline: 2px dashed rgba(34, 211, 238, 0.55) !important;
    outline-offset: 2px !important;
  }
  [data-criaai-nav-chip] {
    position: absolute !important;
    top: -12px !important;
    right: -10px !important;
    background: linear-gradient(135deg, #22d3ee, #7c5cff) !important;
    color: #fff !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    padding: 3px 9px !important;
    border-radius: 999px !important;
    z-index: 2147483647 !important;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif !important;
    letter-spacing: 0.02em !important;
    box-shadow: 0 6px 18px rgba(34, 211, 238, 0.45) !important;
    white-space: nowrap !important;
    line-height: 1.1 !important;
    cursor: pointer !important;
    user-select: none !important;
    pointer-events: auto !important;
    border: 1px solid rgba(255,255,255,0.35) !important;
    transition: transform 120ms ease, box-shadow 120ms ease !important;
  }
  [data-criaai-nav-chip]:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 8px 22px rgba(124, 92, 255, 0.55) !important;
  }
  html[data-criaai-mode="preview"] [data-criaai-nav-chip] { display: none !important; }
  html[data-criaai-mode="preview"] [data-criaai-nav] { outline: none !important; }
`;

const EDITOR_BRIDGE_JS = `(() => {
  const MEDIA_TAGS = new Set(['IMG','VIDEO','IFRAME','AUDIO','SOURCE','PICTURE']);
  // Multi-strategy element resolver. Used by applyCustomizations and
  // markNavigation: the backend sends us the anchor/edge with three possible
  // keys — prefer the most stable one, degrade gracefully.
  const resolveEl = (item) => {
    if (!item) return null;
    // 1) stable id (data-criaai-id / stableId / actionId)
    const stable = item.stableId || item.actionId;
    if (stable) {
      try {
        const el = document.querySelector('[data-criaai-id="' + CSS.escape(stable) + '"]');
        if (el) return el;
      } catch (_) {}
    }
    // 2) css selector
    if (item.selector) {
      try {
        const el = document.querySelector(item.selector);
        if (el) return el;
      } catch (_) {}
    }
    // 3) text fallback: match an <a>/<button>/<label> whose trimmed text
    //    equals the provided label or triggerText.
    const needle = (item.label || item.triggerText || '').trim().toLowerCase();
    if (needle) {
      try {
        const candidates = document.querySelectorAll('a,button,[role="button"],label,[role="radio"],[role="option"],iframe,video,form');
        for (const c of candidates) {
          const t = (c.innerText || c.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
          if (t && (t === needle || (needle.length >= 8 && t.indexOf(needle) !== -1))) return c;
        }
      } catch (_) {}
    }
    return null;
  };
  const findEditable = (start) => {
    let node = start;
    while (node && node !== document.body && node.nodeType === 1) {
      if (node.dataset && node.dataset.editorId) return node;
      node = node.parentElement;
    }
    return null;
  };
  let selected = null;
  const deselect = () => {
    if (!selected) return;
    selected.removeAttribute('data-editor-selected');
    if (selected.getAttribute('contenteditable') === 'true') {
      selected.removeAttribute('contenteditable');
    }
    selected = null;
  };
  const select = (el, opts) => {
    if (!el) return;
    if (selected && selected !== el) deselect();
    selected = el;
    el.setAttribute('data-editor-selected', '');
    if (!MEDIA_TAGS.has(el.tagName)) {
      el.setAttribute('contenteditable', 'true');
      if (!opts || !opts.silent) {
        try { el.focus({ preventScroll: false }); } catch (_) { el.focus(); }
      }
    }
    try {
      window.parent.postMessage({ type: 'editor.select', id: el.dataset.editorId }, '*');
    } catch (_) { /* noop */ }
  };
  document.addEventListener('click', (event) => {
    if (editorMode === 'preview') return;
    const chip = event.target && event.target.closest && event.target.closest('[data-criaai-nav-chip]');
    if (chip) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      const stepId = chip.getAttribute('data-target-step') || '';
      try { window.parent.postMessage({ type: 'editor.navigateTo', stepId: stepId }, '*'); } catch (_) {}
      return;
    }
    const target = findEditable(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    select(target);
  }, true);
  document.addEventListener('mousedown', (event) => {
    if (editorMode === 'preview') return;
    const anchor = event.target && event.target.closest && event.target.closest('a[href]');
    if (anchor) { event.preventDefault(); }
  }, true);
  document.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { deselect(); }
  }, true);
  document.addEventListener('input', (event) => {
    const target = findEditable(event.target);
    if (!target) return;
    const id = target.dataset.editorId;
    if (!id) return;
    try {
      window.parent.postMessage({
        type: 'editor.text',
        id: id,
        value: target.textContent || ''
      }, '*');
    } catch (_) { /* noop */ }
  }, true);
  let editorMode = 'edit';
  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (!data.type) return;
    if (data.type === 'editor.setMode') {
      editorMode = data.preview ? 'preview' : 'edit';
      document.documentElement.setAttribute('data-criaai-mode', editorMode);
      if (editorMode === 'preview') {
        deselect();
      }
      return;
    }
    if (data.type === 'editor.markNavigation' && Array.isArray(data.items)) {
      try {
        document.querySelectorAll('[data-criaai-nav-chip]').forEach((node) => {
          node.remove();
        });
        document.querySelectorAll('[data-criaai-nav]').forEach((node) => {
          node.removeAttribute('data-criaai-nav');
        });
        for (const item of data.items) {
          if (!item) continue;
          var el = resolveEl(item);
          if (!el) continue;
          const label = String(item.label || '').slice(0, 32);
          const stepId = String(item.stepId || '');
          const trigger = String(item.triggerText || '');
          el.setAttribute('data-criaai-nav', '\u2192 ' + label);
          const cs = (el.ownerDocument || document).defaultView.getComputedStyle(el);
          if (cs && cs.position === 'static') {
            el.style.position = 'relative';
          }
          const chip = document.createElement('span');
          chip.setAttribute('data-criaai-nav-chip', '');
          chip.setAttribute('contenteditable', 'false');
          chip.setAttribute('data-target-step', stepId);
          chip.setAttribute('title', 'Abrir ' + label + (trigger ? ' (' + trigger + ')' : ''));
          chip.textContent = '\u2192 ' + label;
          el.appendChild(chip);
        }
      } catch (_) {}
      return;
    }
    if (data.type === 'editor.applyCustomizations' && Array.isArray(data.items)) {
      data.items.forEach((item) => {
        if (!item) return;
        var target = resolveEl(item);
        if (!target) return;
        const value = (item.value || '').trim();
        const behavior = item.behavior || (item.kind === 'video' ? (item.tag === 'iframe' || item.tag === 'video' ? 'rewrite-src' : 'replace-embed') : (item.tag === 'a' ? 'rewrite-href' : item.tag === 'form' ? 'rewrite-action' : 'inject-click'));
        if (item.kind === 'checkout') {
          if (!value) {
            target.setAttribute('data-criaai-custom', item.id || '');
            return;
          }
          if (behavior === 'rewrite-href') {
            if (target.tagName === 'A') {
              target.setAttribute('href', value);
              target.removeAttribute('target');
            } else {
              const parent = target.closest && target.closest('a[href]');
              if (parent) {
                parent.setAttribute('href', value);
                parent.removeAttribute('target');
              } else {
                target.setAttribute('href', value);
              }
            }
          } else if (behavior === 'rewrite-action') {
            target.setAttribute('action', value);
          } else {
            target.setAttribute('data-href', value);
            target.setAttribute('onclick', "window.top?window.top.location.href='" + value.replace(/'/g, "\\'") + "':window.location.href='" + value.replace(/'/g, "\\'") + "';return false;");
          }
          target.setAttribute('data-criaai-custom', item.id || '');
        } else if (item.kind === 'video') {
          if (!value) return;
          if (behavior === 'rewrite-src') {
            target.setAttribute('src', value);
            target.removeAttribute('srcdoc');
            if (target.tagName === 'VIDEO') {
              const sources = target.querySelectorAll && target.querySelectorAll('source');
              if (sources && sources.length) sources.forEach((s) => s.remove());
            }
          } else {
            var isSlotContainer = target.hasAttribute && (target.hasAttribute('data-criaai-vsl') || (target.classList && target.classList.contains('sp-vsl-frame')));
            if (isSlotContainer) {
              // Try to reuse an existing iframe inside the slot for snappier
              // live updates; otherwise, reset the slot and inject one.
              var existing = target.querySelector && target.querySelector('iframe[data-criaai-custom], iframe');
              if (existing) {
                existing.setAttribute('src', value);
                existing.setAttribute('data-criaai-custom', item.id || '');
              } else {
                while (target.firstChild) target.removeChild(target.firstChild);
                if (target.classList) target.classList.remove('sp-vsl-placeholder');
                var iframeA = document.createElement('iframe');
                iframeA.src = value;
                iframeA.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
                iframeA.setAttribute('allowfullscreen', '');
                iframeA.setAttribute('frameborder', '0');
                iframeA.setAttribute('data-criaai-custom', item.id || '');
                iframeA.style.width = '100%';
                iframeA.style.height = '100%';
                iframeA.style.border = '0';
                iframeA.style.display = 'block';
                target.appendChild(iframeA);
              }
            } else {
              var w = target.getAttribute('width') || '100%';
              var h = target.getAttribute('height') || '420';
              var iframeB = document.createElement('iframe');
              iframeB.src = value;
              iframeB.width = w;
              iframeB.height = h;
              iframeB.frameBorder = '0';
              iframeB.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
              iframeB.setAttribute('allowfullscreen', '');
              iframeB.setAttribute('data-criaai-custom', item.id || '');
              target.replaceWith(iframeB);
            }
          }
        }
      });
      return;
    }
    if (!data.id) return;
    if (data.type === 'editor.set') {
      const target = document.querySelector('[data-editor-id="' + data.id + '"]');
      if (!target) return;
      if (data.kind === 'text') {
        if (document.activeElement !== target) {
          target.textContent = data.value || '';
        }
      } else if (data.kind === 'src') {
        target.setAttribute('src', data.value || '');
      }
    } else if (data.type === 'editor.highlight') {
      const target = document.querySelector('[data-editor-id="' + data.id + '"]');
      if (!target) return;
      select(target, { silent: true });
      try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* noop */ }
    }
  });
  document.documentElement.setAttribute('data-criaai-editor', 'on');
  try { window.parent.postMessage({ type: 'editor.ready' }, '*'); } catch (_) {}
})();`;

function withEditorBridge(
  html: string,
  renderMode: 'runtime' | 'frozen',
): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll<HTMLElement>('[data-editor-selected]')
    .forEach((node) => node.removeAttribute('data-editor-selected'));
  if (renderMode === 'frozen') {
    doc.querySelectorAll('script').forEach((node) => node.remove());
    doc.querySelectorAll('noscript').forEach((node) => node.remove());
  }
  doc
    .querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
    .forEach((node) => node.remove());
  doc
    .querySelectorAll('meta[http-equiv="Content-Security-Policy-Report-Only"]')
    .forEach((node) => node.remove());

  if (doc.head) {
    const style = doc.createElement('style');
    style.id = 'criaai-editor-bridge-style';
    style.textContent = EDITOR_BRIDGE_CSS;
    doc.head.appendChild(style);
  }
  if (doc.body) {
    const script = doc.createElement('script');
    script.id = 'criaai-editor-bridge-script';
    script.textContent = EDITOR_BRIDGE_JS;
    doc.body.appendChild(script);
  }
  return doc.documentElement.outerHTML;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file read result'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
