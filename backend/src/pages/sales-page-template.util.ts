/**
 * Sales-page HTML renderer.
 *
 * Three orthogonal axes of variation:
 *   - LAYOUT     : vsl-hero | story-driven | authority-led — see
 *                  sales-page-design.util.ts for details.
 *   - PALETTE    : 5 professional palettes, CSS variables.
 *   - TYPOGRAPHY : 3 display/body pairings.
 *
 * A single rich `SalesPageCopy` shape feeds every layout. Each layout
 * composes shared section renderers in a different order / emphasis so the
 * result feels fundamentally different, not just "reskinned".
 */

import {
  isLightPalette,
  paletteToCssVars,
  typographyToCssVars,
  type DesignSelection,
  type LanguageKey,
  type LayoutVariant,
  type ToneKey,
} from './sales-page-design.util';

export type SalesPageTone = ToneKey;
export type SalesPageLanguage = LanguageKey;

export interface SalesPageBenefit {
  title: string;
  description: string;
}

export interface SalesPageBonus {
  title: string;
  description: string;
  valueLine?: string;
}

export interface SalesPageTestimonial {
  quote: string;
  author: string;
  role?: string;
  result?: string;
}

export interface SalesPageFaq {
  question: string;
  answer: string;
}

export interface SalesPageProofStat {
  value: string;
  label: string;
}

export interface SalesPageAuthorityBio {
  name: string;
  role?: string;
  bio: string;
  credentials?: string[];
}

export interface SalesPageUrgency {
  headline: string;
  body: string;
}

export interface SalesPageUniqueMechanism {
  title: string;
  description: string;
  steps?: string[];
}

export interface SalesPageCopy {
  title: string;
  kicker?: string;
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta?: string;

  storyHook?: string;
  agitation?: string[];
  painPoints: string[];

  uniqueMechanism?: SalesPageUniqueMechanism;
  benefits: SalesPageBenefit[];
  bonuses?: SalesPageBonus[];
  proofStats?: SalesPageProofStat[];
  authorityBio?: SalesPageAuthorityBio;
  urgency?: SalesPageUrgency;

  offer: {
    title: string;
    priceLine: string;
    bullets: string[];
    guarantee?: string;
  };
  testimonials: SalesPageTestimonial[];
  faq: SalesPageFaq[];

  footerNote?: string;
  productName: string;
  language: SalesPageLanguage;
}

export interface RenderSalesPageOptions {
  copy: SalesPageCopy;
  design: DesignSelection;
  vslUrl?: string;
  checkoutUrl?: string;
}

/* ================================================================== */
/*  SVG + i18n helpers                                                 */
/* ================================================================== */

const SVG = {
  sparkles:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M4.22 4.22l2.83 2.83"/><path d="M16.95 16.95l2.83 2.83"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M4.22 19.78l2.83-2.83"/><path d="M16.95 7.05l2.83-2.83"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  quote:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 17h-3l2-8h3zm9 0h-3l2-8h3z"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H8a2.5 2.5 0 010-5c3 0 4 5 4 5z"/><path d="M12 7h4a2.5 2.5 0 000-5c-3 0-4 5-4 5z"/></svg>',
};

const I18N = {
  'pt-BR': {
    painTitle: 'Você se reconhece nisso?',
    agitationTitle: 'E isso, no fundo, te custa mais do que parece',
    mechanismTitle:
      'Por que nosso método funciona (mesmo se você já tentou de tudo)',
    benefitsTitle: 'O que você vai conquistar',
    bonusTitle: 'Bônus inclusos na sua inscrição',
    offerTitle: 'A oferta completa',
    testimonialsTitle: 'Quem já aplicou — e o que mudou',
    faqTitle: 'Perguntas frequentes',
    authorityTitle: 'Quem está por trás do método',
    proofTitle: 'Os números não mentem',
    urgencyTitle: 'Atenção',
    finalTitle: 'Pronto para começar?',
    finalSub:
      'Sua transformação começa no próximo clique — e você está a um passo.',
    ctaSub: 'Acesso imediato após a confirmação',
    ctaPlaceholder: 'Cole aqui o link da sua VSL',
    vslHint:
      'Suporta YouTube, Vimeo, Wistia, Panda Video, VTurb, ConverteAI e qualquer embed.',
  },
  'en-US': {
    painTitle: 'Does this sound familiar?',
    agitationTitle: "And deep down, it's costing you more than it seems",
    mechanismTitle: 'Why our method works (even if you have tried everything)',
    benefitsTitle: "What you'll get",
    bonusTitle: 'Included bonuses',
    offerTitle: 'The complete offer',
    testimonialsTitle: 'Real results from real people',
    faqTitle: 'Frequently asked questions',
    authorityTitle: 'Who is behind the method',
    proofTitle: "Numbers don't lie",
    urgencyTitle: 'Heads up',
    finalTitle: 'Ready to start?',
    finalSub:
      'Your transformation starts with the next click — you are one step away.',
    ctaSub: 'Instant access after confirmation',
    ctaPlaceholder: 'Paste your VSL link here',
    vslHint:
      'Supports YouTube, Vimeo, Wistia, Panda Video, VTurb, ConverteAI and any embed.',
  },
  'es-ES': {
    painTitle: '¿Te identificas con esto?',
    agitationTitle: 'Y en el fondo, te está costando más de lo que parece',
    mechanismTitle:
      'Por qué nuestro método funciona (aunque ya lo hayas intentado todo)',
    benefitsTitle: 'Lo que vas a lograr',
    bonusTitle: 'Bonos incluidos en tu inscripción',
    offerTitle: 'La oferta completa',
    testimonialsTitle: 'Resultados reales de personas reales',
    faqTitle: 'Preguntas frecuentes',
    authorityTitle: 'Quién está detrás del método',
    proofTitle: 'Los números no mienten',
    urgencyTitle: 'Atención',
    finalTitle: '¿Listo para empezar?',
    finalSub: 'Tu transformación empieza en el próximo clic — estás a un paso.',
    ctaSub: 'Acceso inmediato tras la confirmación',
    ctaPlaceholder: 'Pega aquí el enlace de tu VSL',
    vslHint:
      'Compatible con YouTube, Vimeo, Wistia, Panda Video, VTurb, ConverteAI y cualquier embed.',
  },
} as const;

/* ================================================================== */
/*  Escape                                                              */
/* ================================================================== */

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================================================================== */
/*  Slot renderers                                                      */
/* ================================================================== */

function renderVslSlot(
  vslUrl: string | undefined,
  lang: SalesPageLanguage,
): string {
  const t = I18N[lang];
  if (vslUrl) {
    return `
      <div class="sp-vsl-frame" data-criaai-vsl="vsl-primary">
        <iframe
          src="${esc(vslUrl)}"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
          title="Video"
        ></iframe>
      </div>
    `;
  }
  return `
    <div class="sp-vsl-frame sp-vsl-placeholder" data-criaai-vsl="vsl-primary">
      <div class="sp-vsl-placeholder-inner">
        <div class="sp-vsl-play">${SVG.play}</div>
        <h3>${esc(t.ctaPlaceholder)}</h3>
        <p>${esc(t.vslHint)}</p>
      </div>
    </div>
  `;
}

function renderCta(
  label: string,
  checkoutUrl: string | undefined,
  variant: 'hero' | 'offer' | 'final' | 'authority',
  showSub = true,
  lang: SalesPageLanguage = 'pt-BR',
): string {
  const href = checkoutUrl ? esc(checkoutUrl) : '#checkout';
  const slotId = variant;
  const sub = showSub ? I18N[lang].ctaSub : '';
  return `
    <a
      class="sp-cta sp-cta-${variant}"
      href="${href}"
      data-criaai-checkout="${slotId}"
      target="_self"
      rel="noopener"
    >
      <span class="sp-cta-label">${esc(label)}</span>
      <span class="sp-cta-icon">${SVG.arrow}</span>
    </a>
    ${sub ? `<span class="sp-cta-sub">${esc(sub)}</span>` : ''}
  `;
}

/* ================================================================== */
/*  Section renderers (shared)                                          */
/* ================================================================== */

function renderHero(
  copy: SalesPageCopy,
  vslUrl: string | undefined,
  checkoutUrl: string | undefined,
  layout: LayoutVariant,
): string {
  const kicker = copy.kicker
    ? `<span class="sp-kicker">${SVG.sparkles}<span>${esc(copy.kicker)}</span></span>`
    : '';
  const headline = highlightHeadline(copy.headline);
  const sub = `<p class="sp-sub">${esc(copy.subheadline)}</p>`;
  const cta = `
    <div class="sp-cta-row" style="margin-top:24px;">
      ${renderCta(copy.primaryCta, checkoutUrl, 'hero', true, copy.language)}
    </div>
  `;
  const vsl = renderVslSlot(vslUrl, copy.language);

  if (layout === 'vsl-hero') {
    return `
      <section class="sp-hero sp-hero--vsl">
        <div class="sp-container">
          ${kicker}
          <h1 class="sp-hero-title">${headline}</h1>
          ${sub}
          <div class="sp-hero-vsl-wrap">${vsl}</div>
          ${cta}
        </div>
      </section>
    `;
  }

  if (layout === 'story-driven') {
    const hook = copy.storyHook
      ? `<p class="sp-story-hook">${esc(copy.storyHook)}</p>`
      : '';
    return `
      <section class="sp-hero sp-hero--story">
        <div class="sp-container sp-container--narrow">
          ${kicker}
          <h1 class="sp-hero-title">${headline}</h1>
          ${hook}
          ${sub}
        </div>
      </section>
    `;
  }

  // authority-led
  const credentials = copy.authorityBio?.credentials ?? [];
  const credsHtml = credentials.length
    ? `<ul class="sp-hero-creds">${credentials
        .slice(0, 4)
        .map((c) => `<li>${SVG.check}<span>${esc(c)}</span></li>`)
        .join('')}</ul>`
    : '';
  return `
    <section class="sp-hero sp-hero--authority">
      <div class="sp-container sp-hero-grid">
        <div>
          ${kicker}
          <h1 class="sp-hero-title">${headline}</h1>
          ${sub}
          ${credsHtml}
          ${cta}
        </div>
        <div class="sp-hero-aside">${vsl}</div>
      </div>
    </section>
  `;
}

function renderPain(copy: SalesPageCopy): string {
  if (!copy.painPoints?.length) return '';
  const t = I18N[copy.language];
  const items = copy.painPoints
    .map(
      (p) => `
        <li><span class="sp-bullet-icon">${SVG.check}</span><span>${esc(p)}</span></li>
      `,
    )
    .join('');
  return `
    <section class="sp-section sp-pain">
      <div class="sp-container sp-container--narrow">
        <h2 class="sp-h2">${esc(t.painTitle)}</h2>
        <ul class="sp-bullet-list">${items}</ul>
      </div>
    </section>
  `;
}

function renderAgitation(copy: SalesPageCopy): string {
  if (!copy.agitation?.length) return '';
  const t = I18N[copy.language];
  const items = copy.agitation
    .map((p) => `<p class="sp-agit-line">${esc(p)}</p>`)
    .join('');
  return `
    <section class="sp-section sp-agit">
      <div class="sp-container sp-container--narrow">
        <h2 class="sp-h2">${esc(t.agitationTitle)}</h2>
        <div class="sp-agit-body">${items}</div>
      </div>
    </section>
  `;
}

function renderMechanism(copy: SalesPageCopy): string {
  const mech = copy.uniqueMechanism;
  if (!mech) return '';
  const t = I18N[copy.language];
  const steps = (mech.steps ?? [])
    .map(
      (s, i) => `
        <div class="sp-mech-step">
          <div class="sp-mech-step-n">${String(i + 1).padStart(2, '0')}</div>
          <div class="sp-mech-step-text">${esc(s)}</div>
        </div>
      `,
    )
    .join('');
  return `
    <section class="sp-section sp-mech">
      <div class="sp-container">
        <h2 class="sp-h2">${esc(t.mechanismTitle)}</h2>
        <div class="sp-mech-card">
          <h3 class="sp-mech-title">${esc(mech.title)}</h3>
          <p class="sp-mech-desc">${esc(mech.description)}</p>
          ${steps ? `<div class="sp-mech-steps">${steps}</div>` : ''}
        </div>
      </div>
    </section>
  `;
}

function renderBenefits(
  copy: SalesPageCopy,
  emphasis: 'grid' | 'list',
): string {
  if (!copy.benefits?.length) return '';
  const t = I18N[copy.language];
  if (emphasis === 'list') {
    const items = copy.benefits
      .map(
        (b) => `
          <li>
            <span class="sp-bullet-icon">${SVG.check}</span>
            <div><strong>${esc(b.title)}</strong><br><span>${esc(b.description)}</span></div>
          </li>
        `,
      )
      .join('');
    return `
      <section class="sp-section sp-benefits sp-benefits--list">
        <div class="sp-container sp-container--narrow">
          <h2 class="sp-h2">${esc(t.benefitsTitle)}</h2>
          <ul class="sp-bullet-list">${items}</ul>
        </div>
      </section>
    `;
  }
  const items = copy.benefits
    .map(
      (b) => `
        <article class="sp-benefit">
          <div class="sp-benefit-icon">${SVG.sparkles}</div>
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.description)}</p>
        </article>
      `,
    )
    .join('');
  return `
    <section class="sp-section sp-benefits">
      <div class="sp-container">
        <h2 class="sp-h2">${esc(t.benefitsTitle)}</h2>
        <div class="sp-benefits-grid">${items}</div>
      </div>
    </section>
  `;
}

function renderProofStats(copy: SalesPageCopy): string {
  if (!copy.proofStats?.length) return '';
  const t = I18N[copy.language];
  const items = copy.proofStats
    .map(
      (s) => `
        <div class="sp-stat">
          <div class="sp-stat-value">${esc(s.value)}</div>
          <div class="sp-stat-label">${esc(s.label)}</div>
        </div>
      `,
    )
    .join('');
  return `
    <section class="sp-section sp-proof">
      <div class="sp-container">
        <h2 class="sp-h2 sp-h2--center">${esc(t.proofTitle)}</h2>
        <div class="sp-stats-grid">${items}</div>
      </div>
    </section>
  `;
}

function renderBonuses(copy: SalesPageCopy): string {
  if (!copy.bonuses?.length) return '';
  const t = I18N[copy.language];
  const items = copy.bonuses
    .map(
      (b) => `
        <article class="sp-bonus">
          <div class="sp-bonus-icon">${SVG.gift}</div>
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.description)}</p>
          ${b.valueLine ? `<div class="sp-bonus-value">${esc(b.valueLine)}</div>` : ''}
        </article>
      `,
    )
    .join('');
  return `
    <section class="sp-section sp-bonuses">
      <div class="sp-container">
        <h2 class="sp-h2 sp-h2--center">${esc(t.bonusTitle)}</h2>
        <div class="sp-bonuses-grid">${items}</div>
      </div>
    </section>
  `;
}

function renderVslStandalone(
  vslUrl: string | undefined,
  lang: SalesPageLanguage,
): string {
  return `
    <section class="sp-section sp-vsl-standalone">
      <div class="sp-container sp-container--narrow">
        ${renderVslSlot(vslUrl, lang)}
      </div>
    </section>
  `;
}

function renderAuthority(copy: SalesPageCopy): string {
  const bio = copy.authorityBio;
  if (!bio) return '';
  const t = I18N[copy.language];
  const creds = (bio.credentials ?? [])
    .map((c) => `<li>${SVG.check}<span>${esc(c)}</span></li>`)
    .join('');
  return `
    <section class="sp-section sp-authority">
      <div class="sp-container sp-container--narrow">
        <h2 class="sp-h2">${esc(t.authorityTitle)}</h2>
        <div class="sp-authority-card">
          <div class="sp-authority-meta">
            <strong>${esc(bio.name)}</strong>
            ${bio.role ? `<span>${esc(bio.role)}</span>` : ''}
          </div>
          <p class="sp-authority-bio">${esc(bio.bio)}</p>
          ${creds ? `<ul class="sp-authority-creds">${creds}</ul>` : ''}
        </div>
      </div>
    </section>
  `;
}

function renderOffer(
  copy: SalesPageCopy,
  checkoutUrl: string | undefined,
): string {
  const t = I18N[copy.language];
  const offer = copy.offer;
  const bullets = (offer.bullets ?? [])
    .map(
      (b) => `
        <li><span class="sp-bullet-icon">${SVG.check}</span><span>${esc(b)}</span></li>
      `,
    )
    .join('');
  return `
    <section class="sp-section sp-offer" id="oferta">
      <div class="sp-container">
        <h2 class="sp-h2 sp-h2--center">${esc(t.offerTitle)}</h2>
        <div class="sp-offer-card">
          <h3 class="sp-offer-heading">${esc(offer.title)}</h3>
          <ul class="sp-bullet-list">${bullets}</ul>
          <div class="sp-offer-price">${esc(offer.priceLine)}</div>
          <div class="sp-cta-row" style="justify-content:center;">
            ${renderCta(copy.primaryCta, checkoutUrl, 'offer', false, copy.language)}
          </div>
          ${
            offer.guarantee
              ? `
                <div class="sp-guarantee">
                  <span class="sp-guarantee-icon">${SVG.shield}</span>
                  <span>${esc(offer.guarantee)}</span>
                </div>
              `
              : ''
          }
        </div>
      </div>
    </section>
  `;
}

function renderTestimonials(
  copy: SalesPageCopy,
  emphasis: 'grid' | 'wide',
): string {
  if (!copy.testimonials?.length) return '';
  const t = I18N[copy.language];
  const items = copy.testimonials
    .map((tm) => {
      const stars = Array(5)
        .fill(0)
        .map(() => `<span class="sp-star">${SVG.star}</span>`)
        .join('');
      return `
        <figure class="sp-testimonial ${emphasis === 'wide' ? 'sp-testimonial--wide' : ''}">
          <div class="sp-testimonial-quote">${SVG.quote}</div>
          <div class="sp-testimonial-stars">${stars}</div>
          <blockquote>"${esc(tm.quote)}"</blockquote>
          ${tm.result ? `<div class="sp-testimonial-result">${esc(tm.result)}</div>` : ''}
          <figcaption>
            <strong>${esc(tm.author)}</strong>
            ${tm.role ? `<span>${esc(tm.role)}</span>` : ''}
          </figcaption>
        </figure>
      `;
    })
    .join('');
  return `
    <section class="sp-section sp-testimonials">
      <div class="sp-container">
        <h2 class="sp-h2 sp-h2--center">${esc(t.testimonialsTitle)}</h2>
        <div class="sp-testimonials-grid ${emphasis === 'wide' ? 'sp-testimonials-grid--wide' : ''}">${items}</div>
      </div>
    </section>
  `;
}

function renderUrgency(copy: SalesPageCopy): string {
  const u = copy.urgency;
  if (!u) return '';
  const t = I18N[copy.language];
  return `
    <section class="sp-section sp-urgency">
      <div class="sp-container sp-container--narrow">
        <div class="sp-urgency-card">
          <div class="sp-urgency-kicker">
            <span class="sp-urgency-icon">${SVG.clock}</span>
            <span>${esc(t.urgencyTitle)}</span>
          </div>
          <h3 class="sp-urgency-head">${esc(u.headline)}</h3>
          <p>${esc(u.body)}</p>
        </div>
      </div>
    </section>
  `;
}

function renderFaq(copy: SalesPageCopy): string {
  if (!copy.faq?.length) return '';
  const t = I18N[copy.language];
  const items = copy.faq
    .map(
      (f) => `
        <details class="sp-faq-item">
          <summary>${esc(f.question)}</summary>
          <p>${esc(f.answer)}</p>
        </details>
      `,
    )
    .join('');
  return `
    <section class="sp-section sp-faq">
      <div class="sp-container sp-container--narrow">
        <h2 class="sp-h2 sp-h2--center">${esc(t.faqTitle)}</h2>
        <div class="sp-faq-list">${items}</div>
      </div>
    </section>
  `;
}

function renderFinal(
  copy: SalesPageCopy,
  checkoutUrl: string | undefined,
): string {
  const t = I18N[copy.language];
  return `
    <section class="sp-section sp-final">
      <div class="sp-container sp-container--narrow" style="text-align:center;">
        <h2 class="sp-h2">${esc(t.finalTitle)}</h2>
        <p class="sp-final-sub">${esc(t.finalSub)}</p>
        <div class="sp-cta-row" style="justify-content:center;">
          ${renderCta(copy.primaryCta, checkoutUrl, 'final', true, copy.language)}
        </div>
      </div>
    </section>
  `;
}

/* ================================================================== */
/*  Styles                                                              */
/* ================================================================== */

function buildStyles(options: RenderSalesPageOptions): string {
  const { design } = options;
  const light = isLightPalette(design.palette);
  const overlayAdjust = light
    ? `
      .sp-hero::before {
        background: radial-gradient(1200px 520px at 50% -10%, var(--sp-hero-glow), transparent 70%),
          radial-gradient(900px 420px at 80% 10%, color-mix(in srgb, var(--sp-accent) 18%, transparent), transparent 75%);
      }
    `
    : `
      .sp-hero::before {
        background:
          radial-gradient(1200px 520px at 50% -10%, var(--sp-hero-glow), transparent 70%),
          radial-gradient(900px 420px at 80% 10%, color-mix(in srgb, var(--sp-accent) 28%, transparent), transparent 75%);
      }
    `;

  return `
    :root {
      ${paletteToCssVars(design.palette)}
      ${typographyToCssVars(design.typography)}
      --sp-radius: 18px;
      --sp-radius-lg: 26px;
      --sp-max-width: 1120px;
      --sp-max-width-narrow: 760px;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--sp-bg);
      color: var(--sp-text);
      font-family: var(--sp-font-body);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
    }
    img, video, iframe { max-width: 100%; display: block; }
    a { color: inherit; text-decoration: none; }
    h1, h2, h3 {
      font-family: var(--sp-font-display);
      letter-spacing: var(--sp-display-spacing);
      margin: 0;
      color: var(--sp-text);
    }
    p { margin: 0; }
    ul { margin: 0; padding: 0; list-style: none; }
    strong { color: var(--sp-text); }

    .sp-container {
      max-width: var(--sp-max-width);
      margin: 0 auto;
      padding: 0 24px;
      position: relative;
    }
    .sp-container--narrow { max-width: var(--sp-max-width-narrow); }

    .sp-h2 {
      font-size: clamp(26px, 3.2vw, 40px);
      line-height: 1.15;
      margin-bottom: 36px;
      font-weight: 800;
    }
    .sp-h2--center { text-align: center; }

    /* Kicker */
    .sp-kicker {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--sp-primary) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--sp-primary) 35%, transparent);
      color: var(--sp-primary-strong);
      font-size: 13px; font-weight: 600;
      margin-bottom: 18px;
    }
    .sp-kicker svg { width: 16px; height: 16px; }

    /* HERO */
    .sp-hero { position: relative; padding: 84px 0 56px; overflow: hidden; }
    .sp-hero::before {
      content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
    }
    ${overlayAdjust}
    .sp-hero > .sp-container { position: relative; z-index: 1; }
    .sp-hero-title {
      font-size: clamp(34px, 5.2vw, 60px);
      line-height: 1.04;
      margin-bottom: 20px;
      font-weight: 800;
    }
    .sp-hero-title .sp-grad {
      background: linear-gradient(120deg, var(--sp-grad-from), var(--sp-grad-to));
      -webkit-background-clip: text; background-clip: text;
      color: transparent;
    }
    .sp-sub {
      font-size: clamp(16px, 1.9vw, 20px);
      color: var(--sp-text-dim);
      max-width: 720px;
      margin-bottom: 16px;
    }
    .sp-story-hook {
      font-size: clamp(18px, 2.2vw, 22px);
      color: var(--sp-text);
      font-style: italic;
      margin-bottom: 16px;
      padding-left: 20px;
      border-left: 3px solid var(--sp-primary);
    }

    .sp-hero--story .sp-container--narrow { text-align: left; }
    .sp-hero--story .sp-hero-title { font-size: clamp(30px, 4.2vw, 48px); }

    .sp-hero-grid {
      display: grid; gap: 40px;
      grid-template-columns: 1.05fr 1fr;
      align-items: center;
    }
    @media (max-width: 860px) {
      .sp-hero-grid { grid-template-columns: 1fr; }
      .sp-hero-aside { order: -1; }
    }
    .sp-hero-creds {
      display: grid; gap: 10px; margin: 22px 0;
    }
    .sp-hero-creds li {
      display: flex; align-items: center; gap: 10px;
      color: var(--sp-text-dim); font-size: 14px;
    }
    .sp-hero-creds svg {
      width: 16px; height: 16px; color: var(--sp-accent);
      flex: 0 0 16px;
    }

    /* VSL */
    .sp-vsl-frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sp-radius);
      overflow: hidden;
      background: ${light ? '#0d0f18' : '#050508'};
      border: 1px solid var(--sp-border);
      box-shadow: 0 36px 80px -28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
    }
    .sp-hero-vsl-wrap { margin-top: 32px; }
    .sp-vsl-frame iframe { width: 100%; height: 100%; border: 0; }
    .sp-vsl-placeholder {
      display: flex; align-items: center; justify-content: center;
      background:
        radial-gradient(600px 260px at 50% 40%, color-mix(in srgb, var(--sp-primary) 22%, transparent), transparent 70%),
        ${light ? '#11172a' : '#0c0e17'};
    }
    .sp-vsl-placeholder-inner { text-align: center; padding: 24px; max-width: 460px; color: #f7f7ff; }
    .sp-vsl-play {
      width: 72px; height: 72px; margin: 0 auto 16px;
      border-radius: 999px;
      background: var(--sp-primary);
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      box-shadow: 0 18px 40px -10px var(--sp-cta-shadow);
    }
    .sp-vsl-play svg { width: 32px; height: 32px; margin-left: 4px; }
    .sp-vsl-placeholder h3 { font-size: 18px; margin-bottom: 6px; font-weight: 700; color: #fff; }
    .sp-vsl-placeholder p { font-size: 13px; color: rgba(255,255,255,0.7); }

    /* CTA */
    .sp-cta-row {
      display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
      position: relative;
    }
    .sp-cta {
      display: inline-flex; align-items: center; gap: 12px;
      padding: 18px 30px;
      background: linear-gradient(120deg, var(--sp-primary) 0%, var(--sp-primary-strong) 100%);
      border-radius: 999px;
      color: #ffffff;
      font-family: var(--sp-font-display);
      font-weight: 700; font-size: 17px;
      letter-spacing: 0;
      box-shadow: 0 24px 46px -18px var(--sp-cta-shadow);
      transition: transform .18s ease, filter .18s ease;
      white-space: nowrap;
    }
    .sp-cta:hover { transform: translateY(-1px); filter: brightness(1.06); }
    .sp-cta-icon svg { width: 20px; height: 20px; }
    .sp-cta-sub {
      font-size: 13px; color: var(--sp-text-dim);
      margin-top: 6px;
      width: 100%;
    }
    .sp-cta-offer, .sp-cta-final { font-size: 18px; padding: 20px 36px; }

    /* Sections */
    .sp-section { padding: 72px 0; border-top: 1px solid var(--sp-border); }

    .sp-bullet-list { display: grid; gap: 14px; }
    .sp-bullet-list li {
      display: flex; gap: 14px; align-items: flex-start;
      font-size: 16px; color: var(--sp-text);
    }
    .sp-bullet-list li span:last-child { color: var(--sp-text-dim); }
    .sp-bullet-list li strong { color: var(--sp-text); }
    .sp-bullet-icon {
      flex: 0 0 26px; width: 26px; height: 26px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--sp-accent) 18%, transparent);
      color: var(--sp-accent);
      display: flex; align-items: center; justify-content: center;
    }
    .sp-bullet-icon svg { width: 14px; height: 14px; }

    /* Agitation */
    .sp-agit-body { display: grid; gap: 16px; }
    .sp-agit-line {
      font-size: clamp(17px, 2vw, 21px);
      color: var(--sp-text);
      line-height: 1.55;
      padding: 16px 20px;
      border-left: 3px solid var(--sp-primary);
      background: color-mix(in srgb, var(--sp-primary) 6%, transparent);
      border-radius: 0 var(--sp-radius) var(--sp-radius) 0;
    }

    /* Mechanism */
    .sp-mech-card {
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: var(--sp-radius-lg);
      padding: clamp(28px, 4vw, 44px);
      box-shadow: 0 40px 80px -40px rgba(0,0,0,0.3);
    }
    .sp-mech-title {
      font-size: clamp(22px, 2.4vw, 28px);
      font-weight: 800;
      margin-bottom: 12px;
    }
    .sp-mech-desc {
      color: var(--sp-text-dim);
      font-size: 17px;
      max-width: 720px;
      margin-bottom: 28px;
    }
    .sp-mech-steps {
      display: grid; gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .sp-mech-step {
      display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: flex-start;
      padding: 18px; border-radius: var(--sp-radius);
      background: var(--sp-surface-alt);
      border: 1px solid var(--sp-border);
    }
    .sp-mech-step-n {
      font-family: var(--sp-font-display);
      font-size: 22px; font-weight: 800;
      background: linear-gradient(135deg, var(--sp-primary), var(--sp-primary-strong));
      -webkit-background-clip: text; background-clip: text; color: transparent;
      min-width: 36px;
    }
    .sp-mech-step-text { color: var(--sp-text-dim); font-size: 15px; }

    /* Benefits */
    .sp-benefits-grid {
      display: grid; gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .sp-benefit {
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: var(--sp-radius);
      padding: 28px;
      transition: transform .2s ease, border-color .2s ease;
    }
    .sp-benefit:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--sp-primary) 35%, transparent); }
    .sp-benefit-icon {
      width: 44px; height: 44px; margin-bottom: 14px;
      border-radius: 12px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--sp-primary) 30%, transparent), color-mix(in srgb, var(--sp-accent) 30%, transparent));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .sp-benefit-icon svg { width: 22px; height: 22px; }
    .sp-benefit h3 { font-size: 18px; margin-bottom: 8px; font-weight: 700; }
    .sp-benefit p { color: var(--sp-text-dim); font-size: 15px; }

    /* Bonuses */
    .sp-bonuses-grid {
      display: grid; gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .sp-bonus {
      position: relative;
      background: linear-gradient(160deg, var(--sp-surface), var(--sp-surface-alt));
      border: 1px solid color-mix(in srgb, var(--sp-primary) 25%, var(--sp-border));
      border-radius: var(--sp-radius);
      padding: 26px;
    }
    .sp-bonus-icon {
      width: 44px; height: 44px; margin-bottom: 14px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--sp-primary) 18%, transparent);
      color: var(--sp-primary-strong);
      display: flex; align-items: center; justify-content: center;
    }
    .sp-bonus-icon svg { width: 24px; height: 24px; }
    .sp-bonus h3 { font-size: 17px; margin-bottom: 8px; font-weight: 700; }
    .sp-bonus p { color: var(--sp-text-dim); font-size: 15px; margin-bottom: 10px; }
    .sp-bonus-value {
      display: inline-block;
      font-size: 13px; font-weight: 700;
      color: var(--sp-accent);
      background: color-mix(in srgb, var(--sp-accent) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--sp-accent) 35%, transparent);
      padding: 4px 10px; border-radius: 999px;
    }

    /* Proof stats */
    .sp-stats-grid {
      display: grid; gap: 22px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      text-align: center;
    }
    .sp-stat {
      padding: 24px 12px;
      border-radius: var(--sp-radius);
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
    }
    .sp-stat-value {
      font-family: var(--sp-font-display);
      font-size: clamp(28px, 3.6vw, 42px);
      font-weight: 800;
      background: linear-gradient(120deg, var(--sp-grad-from), var(--sp-grad-to));
      -webkit-background-clip: text; background-clip: text; color: transparent;
      line-height: 1;
      margin-bottom: 8px;
    }
    .sp-stat-label { color: var(--sp-text-dim); font-size: 14px; }

    /* Authority */
    .sp-authority-card {
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: var(--sp-radius-lg);
      padding: clamp(28px, 4vw, 44px);
    }
    .sp-authority-meta { margin-bottom: 16px; }
    .sp-authority-meta strong {
      display: block;
      font-family: var(--sp-font-display);
      font-size: 22px;
      font-weight: 700;
    }
    .sp-authority-meta span { color: var(--sp-text-dim); font-size: 14px; }
    .sp-authority-bio { color: var(--sp-text-dim); font-size: 16px; margin-bottom: 20px; }
    .sp-authority-creds { display: grid; gap: 10px; }
    .sp-authority-creds li {
      display: flex; align-items: center; gap: 10px;
      color: var(--sp-text); font-size: 15px;
    }
    .sp-authority-creds svg {
      width: 16px; height: 16px; color: var(--sp-accent);
    }

    /* Offer */
    .sp-offer-card {
      max-width: 680px; margin: 0 auto;
      background: linear-gradient(180deg, var(--sp-surface-alt), var(--sp-surface));
      border: 1px solid color-mix(in srgb, var(--sp-primary) 30%, var(--sp-border));
      border-radius: 26px;
      padding: clamp(28px, 4vw, 44px);
      text-align: center;
      box-shadow: 0 40px 80px -30px var(--sp-cta-shadow);
    }
    .sp-offer-heading {
      font-size: clamp(22px, 2.8vw, 28px);
      margin-bottom: 22px;
      font-weight: 800;
    }
    .sp-offer-card .sp-bullet-list { text-align: left; margin-bottom: 26px; }
    .sp-offer-price {
      font-size: clamp(30px, 4.2vw, 44px);
      font-weight: 800;
      background: linear-gradient(120deg, var(--sp-grad-from), var(--sp-grad-to));
      -webkit-background-clip: text; background-clip: text;
      color: transparent;
      margin-bottom: 24px;
    }
    .sp-guarantee {
      margin-top: 22px;
      display: inline-flex; align-items: center; gap: 10px;
      padding: 10px 16px;
      background: color-mix(in srgb, var(--sp-success) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--sp-success) 40%, transparent);
      border-radius: 999px;
      color: var(--sp-success);
      font-size: 13px; font-weight: 600;
    }
    .sp-guarantee svg { width: 16px; height: 16px; }

    /* Testimonials */
    .sp-testimonials-grid {
      display: grid; gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    .sp-testimonials-grid--wide { grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
    .sp-testimonial {
      margin: 0;
      position: relative;
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: var(--sp-radius);
      padding: 28px;
    }
    .sp-testimonial-quote {
      position: absolute; top: 16px; right: 16px;
      width: 32px; height: 32px;
      color: color-mix(in srgb, var(--sp-primary) 40%, transparent);
    }
    .sp-testimonial-quote svg { width: 100%; height: 100%; }
    .sp-testimonial-stars {
      display: flex; gap: 2px; margin-bottom: 12px;
      color: #ffc857;
    }
    .sp-star svg { width: 16px; height: 16px; }
    .sp-testimonial blockquote { margin: 0 0 12px 0; font-size: 15px; color: var(--sp-text); font-style: italic; }
    .sp-testimonial-result {
      display: inline-block;
      font-size: 13px; font-weight: 700;
      color: var(--sp-success);
      background: color-mix(in srgb, var(--sp-success) 14%, transparent);
      padding: 4px 10px; border-radius: 999px;
      margin-bottom: 14px;
    }
    .sp-testimonial figcaption strong { display: block; font-size: 14px; color: var(--sp-text); }
    .sp-testimonial figcaption span { font-size: 13px; color: var(--sp-text-dim); }

    /* Urgency */
    .sp-urgency-card {
      border-radius: var(--sp-radius-lg);
      padding: clamp(24px, 3vw, 36px);
      background: linear-gradient(135deg, color-mix(in srgb, var(--sp-primary) 18%, transparent), color-mix(in srgb, var(--sp-accent) 14%, transparent));
      border: 1px solid color-mix(in srgb, var(--sp-primary) 35%, var(--sp-border));
    }
    .sp-urgency-kicker {
      display: inline-flex; align-items: center; gap: 8px;
      color: var(--sp-primary-strong);
      font-weight: 700; font-size: 13px;
      text-transform: uppercase; letter-spacing: 0.12em;
      margin-bottom: 10px;
    }
    .sp-urgency-icon svg { width: 18px; height: 18px; }
    .sp-urgency-head {
      font-size: clamp(22px, 2.8vw, 30px);
      font-weight: 800;
      margin-bottom: 10px;
    }
    .sp-urgency-card p { color: var(--sp-text-dim); font-size: 16px; }

    /* FAQ */
    .sp-faq-list { display: grid; gap: 12px; }
    .sp-faq-item {
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: 14px;
      padding: 20px 24px;
    }
    .sp-faq-item[open] { border-color: color-mix(in srgb, var(--sp-primary) 35%, transparent); }
    .sp-faq-item summary {
      list-style: none; cursor: pointer;
      font-weight: 600; font-size: 16px;
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px;
    }
    .sp-faq-item summary::-webkit-details-marker { display: none; }
    .sp-faq-item summary::after {
      content: '+';
      font-size: 24px; color: var(--sp-primary-strong);
      transition: transform .2s ease;
    }
    .sp-faq-item[open] summary::after { transform: rotate(45deg); }
    .sp-faq-item p { margin-top: 10px; color: var(--sp-text-dim); font-size: 15px; }

    /* Final */
    .sp-final {
      background:
        radial-gradient(900px 420px at 50% 50%, var(--sp-hero-glow), transparent 70%),
        var(--sp-bg);
    }
    .sp-final-sub { max-width: 520px; margin: 0 auto 28px; color: var(--sp-text-dim); font-size: 17px; }

    /* Footer */
    .sp-footer {
      padding: 40px 0;
      border-top: 1px solid var(--sp-border);
      color: var(--sp-text-dim);
      font-size: 13px;
      text-align: center;
    }

    /* Mobile */
    @media (max-width: 720px) {
      .sp-section { padding: 56px 0; }
      .sp-hero { padding: 64px 0 44px; }
      .sp-cta { padding: 16px 26px; font-size: 16px; }
    }
  `;
}

/* ================================================================== */
/*  Headline highlight                                                  */
/* ================================================================== */

function highlightHeadline(headline: string): string {
  const clean = (headline ?? '').trim();
  if (!clean) return '';
  const words = clean.split(/\s+/);
  if (words.length <= 3) return esc(clean);
  const pivot = Math.max(words.length - 2, 3);
  const head = words.slice(0, pivot).join(' ');
  const tail = words.slice(pivot).join(' ');
  return `${esc(head)} <span class="sp-grad">${esc(tail)}</span>`;
}

/* ================================================================== */
/*  Main render                                                         */
/* ================================================================== */

export function renderSalesPage(options: RenderSalesPageOptions): string {
  const { copy, design, vslUrl, checkoutUrl } = options;
  const lang = copy.language;
  const langAttr = lang === 'pt-BR' ? 'pt-br' : lang === 'es-ES' ? 'es' : 'en';

  const layout = design.layout.id;

  const hero = renderHero(copy, vslUrl, checkoutUrl, layout);
  const pain = renderPain(copy);
  const agitation = renderAgitation(copy);
  const mechanism = renderMechanism(copy);
  const benefitsGrid = renderBenefits(copy, 'grid');
  const benefitsList = renderBenefits(copy, 'list');
  const bonuses = renderBonuses(copy);
  const proof = renderProofStats(copy);
  const authority = renderAuthority(copy);
  const offer = renderOffer(copy, checkoutUrl);
  const testimonialsGrid = renderTestimonials(copy, 'grid');
  const testimonialsWide = renderTestimonials(copy, 'wide');
  const urgency = renderUrgency(copy);
  const faq = renderFaq(copy);
  const final = renderFinal(copy, checkoutUrl);
  const vslStandalone = renderVslStandalone(vslUrl, lang);

  // Compose sections based on layout.
  let sections = '';
  if (layout === 'vsl-hero') {
    sections = [
      hero,
      pain,
      mechanism,
      benefitsGrid,
      testimonialsGrid,
      proof,
      offer,
      bonuses,
      faq,
      urgency,
      final,
    ].join('');
  } else if (layout === 'story-driven') {
    sections = [
      hero,
      pain,
      agitation,
      mechanism,
      vslStandalone,
      benefitsList,
      testimonialsWide,
      bonuses,
      offer,
      urgency,
      faq,
      final,
    ].join('');
  } else {
    // authority-led
    sections = [
      hero,
      proof,
      pain,
      mechanism,
      benefitsGrid,
      authority,
      testimonialsGrid,
      offer,
      bonuses,
      faq,
      final,
    ].join('');
  }

  const footer = `
    <footer class="sp-footer">
      <div class="sp-container">
        <div>© ${new Date().getFullYear()} ${esc(copy.productName)}</div>
        ${copy.footerNote ? `<div style="margin-top:6px;">${esc(copy.footerNote)}</div>` : ''}
      </div>
    </footer>
  `;

  return `<!doctype html>
<html lang="${langAttr}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="criaai-sales-generator">
  <meta name="criaai-design-layout" content="${esc(layout)}">
  <meta name="criaai-design-palette" content="${esc(design.palette.id)}">
  <meta name="criaai-design-typography" content="${esc(design.typography.id)}">
  <title>${esc(copy.title)}</title>
  <meta name="description" content="${esc(copy.subheadline)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${esc(design.typography.googleHref)}" rel="stylesheet">
  <style>${buildStyles(options)}</style>
</head>
<body>
  <main>${sections}</main>
  ${footer}
</body>
</html>`;
}
