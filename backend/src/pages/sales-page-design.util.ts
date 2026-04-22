/**
 * Design-system primitives for generated sales pages.
 *
 * A sales page is built from three orthogonal axes:
 *   1. LAYOUT      — section order / emphasis (e.g. VSL-first, story-driven,
 *                    authority-led). See sales-page-variants.util.ts.
 *   2. PALETTE     — colors, surfaces, accents.
 *   3. TYPOGRAPHY  — display + body font pairing.
 *
 * Combining them gives us dozens of visually distinct outputs, so no two
 * customers end up with the same page even if their briefing is similar.
 *
 * Selection is deterministic (hash of product name + niche + workspace) so
 * the same brief always reproduces the same look — reliable, but varied
 * across customers.
 */

export type LayoutVariant =
  | 'vsl-hero'
  | 'story-driven'
  | 'authority-led';

export type ToneKey =
  | 'confident'
  | 'friendly'
  | 'urgent'
  | 'empathetic'
  | 'authoritative'
  | 'playful';

export type LanguageKey = 'pt-BR' | 'en-US' | 'es-ES';

/* ------------------------------------------------------------------ */
/*  PALETTES                                                           */
/* ------------------------------------------------------------------ */

export interface Palette {
  id: string;
  label: string;
  /** Good for which tones (soft match; weight in selection). */
  tones: ToneKey[];
  tokens: {
    bg: string;
    bgAlt: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textDim: string;
    primary: string;
    primaryStrong: string;
    accent: string;
    success: string;
    heroGlow: string;
    ctaShadow: string;
    gradFrom: string;
    gradTo: string;
  };
}

export const PALETTES: Palette[] = [
  {
    id: 'midnight-violet',
    label: 'Midnight Violet (premium tech)',
    tones: ['confident', 'authoritative', 'urgent'],
    tokens: {
      bg: '#0a0b10',
      bgAlt: '#0d0f18',
      surface: '#12141c',
      surfaceAlt: '#161a26',
      border: 'rgba(255,255,255,0.08)',
      text: '#eef1f6',
      textDim: '#9aa2b1',
      primary: '#7a5bff',
      primaryStrong: '#9a80ff',
      accent: '#22d3ee',
      success: '#22c55e',
      heroGlow: 'rgba(122,91,255,0.28)',
      ctaShadow: 'rgba(122,91,255,0.55)',
      gradFrom: '#a395ff',
      gradTo: '#22d3ee',
    },
  },
  {
    id: 'solar-gold',
    label: 'Solar Gold (premium / luxury)',
    tones: ['authoritative', 'confident', 'empathetic'],
    tokens: {
      bg: '#0b0a07',
      bgAlt: '#12110c',
      surface: '#1a1811',
      surfaceAlt: '#211f16',
      border: 'rgba(255, 213, 128, 0.12)',
      text: '#f6efe2',
      textDim: '#b5ad9a',
      primary: '#e2b455',
      primaryStrong: '#f5cf78',
      accent: '#ff9d4d',
      success: '#94d57f',
      heroGlow: 'rgba(226,180,85,0.26)',
      ctaShadow: 'rgba(226,180,85,0.55)',
      gradFrom: '#f5cf78',
      gradTo: '#ff9d4d',
    },
  },
  {
    id: 'clinic-trust',
    label: 'Clinic Trust (health / medical)',
    tones: ['empathetic', 'authoritative', 'friendly'],
    tokens: {
      bg: '#f7f9fc',
      bgAlt: '#eef2f8',
      surface: '#ffffff',
      surfaceAlt: '#f2f5fa',
      border: 'rgba(21, 40, 80, 0.08)',
      text: '#0f1a2b',
      textDim: '#5a6b85',
      primary: '#0c7ff2',
      primaryStrong: '#2897ff',
      accent: '#14b8a6',
      success: '#10b981',
      heroGlow: 'rgba(12,127,242,0.14)',
      ctaShadow: 'rgba(12,127,242,0.35)',
      gradFrom: '#0c7ff2',
      gradTo: '#14b8a6',
    },
  },
  {
    id: 'energy-coral',
    label: 'Energy Coral (fitness / playful)',
    tones: ['playful', 'urgent', 'friendly'],
    tokens: {
      bg: '#0d0a10',
      bgAlt: '#17121b',
      surface: '#1f1824',
      surfaceAlt: '#281f30',
      border: 'rgba(255,122,122,0.16)',
      text: '#fff4ee',
      textDim: '#c2b3b6',
      primary: '#ff5e62',
      primaryStrong: '#ff8a5c',
      accent: '#ffd166',
      success: '#7cd38f',
      heroGlow: 'rgba(255,94,98,0.28)',
      ctaShadow: 'rgba(255,94,98,0.55)',
      gradFrom: '#ff5e62',
      gradTo: '#ffd166',
    },
  },
  {
    id: 'forest-calm',
    label: 'Forest Calm (wellness / education)',
    tones: ['empathetic', 'friendly', 'confident'],
    tokens: {
      bg: '#fbf9f4',
      bgAlt: '#f1ede2',
      surface: '#ffffff',
      surfaceAlt: '#f4f1e8',
      border: 'rgba(44, 68, 46, 0.12)',
      text: '#1a2a1c',
      textDim: '#5d6c5f',
      primary: '#3f8f5a',
      primaryStrong: '#4fa66c',
      accent: '#b8934b',
      success: '#2fa05a',
      heroGlow: 'rgba(63,143,90,0.18)',
      ctaShadow: 'rgba(63,143,90,0.35)',
      gradFrom: '#3f8f5a',
      gradTo: '#b8934b',
    },
  },
];

/* ------------------------------------------------------------------ */
/*  TYPOGRAPHY                                                         */
/* ------------------------------------------------------------------ */

export interface TypographyPair {
  id: string;
  label: string;
  display: { family: string; weights: string };
  body: { family: string; weights: string };
  googleHref: string;
  displayStack: string;
  bodyStack: string;
  displayLetterSpacing?: string;
}

export const TYPOGRAPHY: TypographyPair[] = [
  {
    id: 'inter-manrope',
    label: 'Manrope + Inter (modern tech)',
    display: { family: 'Manrope', weights: '600;700;800' },
    body: { family: 'Inter', weights: '400;500;600;700' },
    googleHref:
      'https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap',
    displayStack:
      "'Manrope', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
    bodyStack:
      "'Inter', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
    displayLetterSpacing: '-0.025em',
  },
  {
    id: 'playfair-inter',
    label: 'Playfair Display + Inter (editorial / premium)',
    display: { family: 'Playfair Display', weights: '600;700;800' },
    body: { family: 'Inter', weights: '400;500;600;700' },
    googleHref:
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap',
    displayStack: "'Playfair Display', 'Georgia', serif",
    bodyStack:
      "'Inter', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
    displayLetterSpacing: '-0.015em',
  },
  {
    id: 'sora-dmsans',
    label: 'Sora + DM Sans (punchy / confident)',
    display: { family: 'Sora', weights: '600;700;800' },
    body: { family: 'DM Sans', weights: '400;500;700' },
    googleHref:
      'https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;700&display=swap',
    displayStack: "'Sora', 'Segoe UI', system-ui, sans-serif",
    bodyStack: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    displayLetterSpacing: '-0.03em',
  },
];

/* ------------------------------------------------------------------ */
/*  LAYOUT REGISTRY                                                    */
/* ------------------------------------------------------------------ */

export interface LayoutMeta {
  id: LayoutVariant;
  label: string;
  description: string;
  tones: ToneKey[];
}

export const LAYOUTS: LayoutMeta[] = [
  {
    id: 'vsl-hero',
    label: 'VSL-first hero',
    description:
      'Vídeo como protagonista no topo, CTA logo abaixo, prova social e oferta compacta.',
    tones: ['confident', 'urgent', 'authoritative'],
  },
  {
    id: 'story-driven',
    label: 'Story / long-form',
    description:
      'Começa com história de transformação, desce pela dor-agitação-solução, CTA aparece depois do emotional peak.',
    tones: ['empathetic', 'friendly', 'playful'],
  },
  {
    id: 'authority-led',
    label: 'Authority-led',
    description:
      'Começa destacando credenciais + dados, layout clean e sóbrio, seções de método e prova densa.',
    tones: ['authoritative', 'confident'],
  },
];

/* ------------------------------------------------------------------ */
/*  HASH / SEED                                                        */
/* ------------------------------------------------------------------ */

/**
 * FNV-1a 32-bit. Deterministic, stable across environments. Using this to
 * derive the design seed — not for anything cryptographic.
 */
function fnv1a32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface DesignSelectionInput {
  productName?: string;
  niche?: string;
  workspaceId?: string;
  tone?: ToneKey;
  /** Preferred layout — overrides deterministic pick when valid. */
  layoutPreference?: LayoutVariant;
  /** Preferred palette id — overrides deterministic pick when valid. */
  palettePreference?: string;
  /** Preferred typography id — overrides deterministic pick when valid. */
  typographyPreference?: string;
}

export interface DesignSelection {
  seed: number;
  layout: LayoutMeta;
  palette: Palette;
  typography: TypographyPair;
}

/**
 * Weighted pick: items matching the tone get a boost, then a deterministic
 * tiebreaker from the seed ensures reproducibility.
 */
function weightedPick<T extends { tones?: ToneKey[] }>(
  items: T[],
  tone: ToneKey | undefined,
  seed: number,
  offset: number,
): T {
  if (!items.length) {
    throw new Error('weightedPick called with empty pool');
  }
  // Boost score for tone match; everyone starts at 1.
  const scored = items.map((item, idx) => {
    const base = 1;
    const toneBonus = tone && item.tones?.includes(tone) ? 2 : 0;
    // Add a tiny deterministic jitter so tone ties break cleanly.
    const jitter = ((seed ^ Math.imul(idx + 1, 2654435761)) >>> 20) / 0xfff;
    return { item, score: base + toneBonus + jitter };
  });
  scored.sort((a, b) => b.score - a.score);
  // From the top 3, pick by seed offset so different offsets pick
  // different items (used when layout and palette share the same tone).
  const top = scored.slice(0, Math.min(3, scored.length));
  const pickIdx = Math.abs((seed + offset) | 0) % top.length;
  return top[pickIdx].item;
}

export function selectDesign(input: DesignSelectionInput): DesignSelection {
  const seedInput =
    `${input.productName ?? 'default-product'}|${input.niche ?? ''}|${
      input.workspaceId ?? ''
    }`.toLowerCase();
  const seed = fnv1a32(seedInput);
  const tone = input.tone;

  const layout =
    (input.layoutPreference &&
      LAYOUTS.find((l) => l.id === input.layoutPreference)) ||
    weightedPick(LAYOUTS, tone, seed, 0);

  const palette =
    (input.palettePreference &&
      PALETTES.find((p) => p.id === input.palettePreference)) ||
    weightedPick(PALETTES, tone, seed, 31);

  const typography =
    (input.typographyPreference &&
      TYPOGRAPHY.find((t) => t.id === input.typographyPreference)) ||
    TYPOGRAPHY[Math.abs(seed >> 3) % TYPOGRAPHY.length];

  return { seed, layout, palette, typography };
}

/* ------------------------------------------------------------------ */
/*  CSS variable helpers                                               */
/* ------------------------------------------------------------------ */

export function paletteToCssVars(palette: Palette): string {
  const t = palette.tokens;
  return [
    `--sp-bg: ${t.bg};`,
    `--sp-bg-alt: ${t.bgAlt};`,
    `--sp-surface: ${t.surface};`,
    `--sp-surface-alt: ${t.surfaceAlt};`,
    `--sp-border: ${t.border};`,
    `--sp-text: ${t.text};`,
    `--sp-text-dim: ${t.textDim};`,
    `--sp-primary: ${t.primary};`,
    `--sp-primary-strong: ${t.primaryStrong};`,
    `--sp-accent: ${t.accent};`,
    `--sp-success: ${t.success};`,
    `--sp-hero-glow: ${t.heroGlow};`,
    `--sp-cta-shadow: ${t.ctaShadow};`,
    `--sp-grad-from: ${t.gradFrom};`,
    `--sp-grad-to: ${t.gradTo};`,
  ].join('\n    ');
}

export function typographyToCssVars(typography: TypographyPair): string {
  return [
    `--sp-font-display: ${typography.displayStack};`,
    `--sp-font-body: ${typography.bodyStack};`,
    `--sp-display-spacing: ${typography.displayLetterSpacing ?? '-0.02em'};`,
  ].join('\n    ');
}

/**
 * Some palettes are light-themed (Clinic Trust, Forest Calm) — the generated
 * CSS must branch a couple of decorative rules based on that. This tells the
 * template whether the palette is a light one.
 */
export function isLightPalette(palette: Palette): boolean {
  // Parse the bg hex luminance — simplest heuristic.
  const hex = palette.tokens.bg.replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}
