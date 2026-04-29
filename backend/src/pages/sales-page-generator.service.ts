import { Injectable, Logger } from '@nestjs/common';
import { OllamaLlmProvider } from '../llm/providers/ollama-llm.provider';
import {
  selectDesign,
  type DesignSelection,
  type LanguageKey,
  type LayoutVariant,
  type ToneKey,
} from './sales-page-design.util';
import {
  renderSalesPage,
  type SalesPageBonus,
  type SalesPageCopy,
  type SalesPageTestimonial,
} from './sales-page-template.util';

export interface SalesPageGenerateInput {
  prompt: string;
  productName?: string;
  title?: string;
  cta?: string;
  audience?: string;
  niche?: string;
  promise?: string;
  uniqueMechanism?: string;
  objections?: string[];
  proofPoints?: string[];
  bonuses?: string[];
  authorName?: string;
  authorRole?: string;
  authorBio?: string;
  urgencyHook?: string;
  priceOffer?: string;
  guarantee?: string;
  tone?: ToneKey;
  language?: LanguageKey;
  layoutPreference?: LayoutVariant;
  palettePreference?: string;
  typographyPreference?: string;
  vslUrl?: string;
  checkoutUrl?: string;
  workspaceId?: string;
}

export interface SalesPageGenerateResult {
  title: string;
  html: string;
  copy: SalesPageCopy;
  design: DesignSelection;
  meta: {
    provider: 'ollama' | 'template-fallback';
    model?: string;
    tone: ToneKey;
    language: LanguageKey;
    layout: string;
    palette: string;
    typography: string;
  };
}

const SYSTEM_PROMPT_BASE = `You are a senior direct-response copywriter, specialized in high-ticket digital products.
You write like Alex Hormozi meets Russell Brunson: specific, vivid, emotional, concrete.
Never generic. Never corporate. No filler words.

Respond with STRICT JSON (no markdown, no code fences) matching this TypeScript schema:

{
  "title": string,              // page <title>
  "kicker": string,             // 2-6 word tag line above headline
  "headline": string,           // main H1, 6-14 words, specific + transformation-focused
  "subheadline": string,        // 1-2 sentences, ~20-35 words
  "storyHook": string,          // optional, 1-3 sentences of narrative intro
  "primaryCta": string,         // 2-6 word imperative
  "painPoints": string[],       // 3-5 specific, visceral pains the audience feels
  "agitation": string[],        // 2-4 lines (each ~20 words) amplifying the cost of staying stuck
  "uniqueMechanism": {
    "title": string,            // name of the method (e.g. "The 3-Phase Metabolic Reset")
    "description": string,      // 2-3 sentences explaining WHY it works differently
    "steps": string[]           // 3-5 steps of the method
  },
  "benefits": [                 // 4-6 concrete outcomes
    { "title": string, "description": string }
  ],
  "bonuses": [                  // 2-4 bonus items included
    { "title": string, "description": string, "valueLine": string }
  ],
  "proofStats": [               // 3-5 credibility numbers
    { "value": string, "label": string }
  ],
  "authorityBio": {             // who is behind the method
    "name": string,
    "role": string,
    "bio": string,              // 2-3 sentences, authority-building
    "credentials": string[]     // 3-5 credentials/achievements
  },
  "urgency": {
    "headline": string,         // scarcity/urgency hook
    "body": string              // 1-2 sentences explaining WHY act now
  },
  "offer": {
    "title": string,
    "priceLine": string,
    "bullets": string[],        // 4-8 deliverables
    "guarantee": string
  },
  "testimonials": [             // 3-4 sounding authentic and specific
    { "quote": string, "author": string, "role": string, "result": string }
  ],
  "faq": [                      // 4-6 addressing REAL objections (not generic)
    { "question": string, "answer": string }
  ],
  "footerNote": string
}

Strict rules:
- Use the product description FAITHFULLY — do not invent features that contradict it.
- Every testimonial must mention a SPECIFIC concrete result (numbers, timeframes, before/after).
- Never use "leverage", "synergy", "empower", "unleash", or other corporate-speak.
- Write in the requested language.
- Match the requested tone.
- Never mention you are an AI.
`;

@Injectable()
export class SalesPageGeneratorService {
  private readonly logger = new Logger(SalesPageGeneratorService.name);

  constructor(private readonly ollama: OllamaLlmProvider) {}

  async generate(
    input: SalesPageGenerateInput,
  ): Promise<SalesPageGenerateResult> {
    const tone: ToneKey = input.tone ?? 'confident';
    const language: LanguageKey = input.language ?? 'pt-BR';

    // Select design DETERMINISTICALLY — same brief → same look, different
    // briefs → different looks. This is what makes every client's page feel
    // distinct.
    const design = selectDesign({
      productName: input.productName,
      niche: input.niche,
      workspaceId: input.workspaceId,
      tone,
      layoutPreference: input.layoutPreference,
      palettePreference: input.palettePreference,
      typographyPreference: input.typographyPreference,
    });

    const userPrompt = this.buildUserPrompt(
      { ...input, tone, language },
      design,
    );

    let copy: SalesPageCopy | null = null;
    let provider: 'ollama' | 'template-fallback' = 'template-fallback';
    let modelUsed: string | undefined;

    if (await this.ollama.isReachable()) {
      try {
        const raw = await this.ollama.chat({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_BASE },
            { role: 'user', content: userPrompt },
          ],
          jsonMode: true,
          temperature: 0.7,
          timeoutMs: 90_000,
        });
        const parsed = this.parseCopyJson(raw, input, language);
        if (parsed) {
          copy = parsed;
          provider = 'ollama';
          modelUsed = this.ollama.model;
        } else {
          this.logger.warn(
            `Ollama returned unusable JSON; falling back to template. head="${raw.slice(0, 160)}"`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Sales-page LLM call failed: ${
            err instanceof Error ? err.message : 'unknown'
          } — falling back to template.`,
        );
      }
    } else {
      this.logger.debug(
        'Ollama unreachable; using deterministic fallback copy',
      );
    }

    if (!copy) {
      copy = this.buildFallbackCopy({ ...input, tone, language });
    }

    const html = renderSalesPage({
      copy,
      design,
      vslUrl: input.vslUrl,
      checkoutUrl: input.checkoutUrl,
    });

    this.logger.log(
      `[sales-gen] layout=${design.layout.id} palette=${design.palette.id} type=${design.typography.id} seed=${design.seed} provider=${provider}`,
    );

    return {
      title: copy.title,
      html,
      copy,
      design,
      meta: {
        provider,
        model: modelUsed,
        tone,
        language,
        layout: design.layout.id,
        palette: design.palette.id,
        typography: design.typography.id,
      },
    };
  }

  private buildUserPrompt(
    input: SalesPageGenerateInput & {
      tone: ToneKey;
      language: LanguageKey;
    },
    design: DesignSelection,
  ): string {
    const lines: string[] = [];
    lines.push(`Language: ${input.language}`);
    lines.push(`Tone: ${input.tone}`);
    lines.push(
      `Layout flavor: ${design.layout.id} (${design.layout.description})`,
    );
    if (input.productName) lines.push(`Product name: ${input.productName}`);
    if (input.niche) lines.push(`Niche: ${input.niche}`);
    if (input.audience) lines.push(`Audience: ${input.audience}`);
    if (input.promise) lines.push(`Main promise: ${input.promise}`);
    if (input.uniqueMechanism)
      lines.push(
        `Unique mechanism (use this faithfully): ${input.uniqueMechanism}`,
      );
    if (input.priceOffer) lines.push(`Price/offer line: ${input.priceOffer}`);
    if (input.guarantee) lines.push(`Guarantee: ${input.guarantee}`);
    if (input.cta) lines.push(`Preferred primary CTA wording: ${input.cta}`);
    if (input.urgencyHook)
      lines.push(`Urgency/scarcity hook: ${input.urgencyHook}`);
    if (input.authorName || input.authorRole || input.authorBio) {
      lines.push('Author info:');
      if (input.authorName) lines.push(`  Name: ${input.authorName}`);
      if (input.authorRole) lines.push(`  Role: ${input.authorRole}`);
      if (input.authorBio) lines.push(`  Bio: ${input.authorBio}`);
    }
    if (input.objections?.length) {
      lines.push('Objections to address in FAQ (use these exactly):');
      input.objections.forEach((o) => lines.push(`  - ${o}`));
    }
    if (input.proofPoints?.length) {
      lines.push('Proof points (weave into copy):');
      input.proofPoints.forEach((p) => lines.push(`  - ${p}`));
    }
    if (input.bonuses?.length) {
      lines.push(
        'Bonuses to include (expand into title + description + value):',
      );
      input.bonuses.forEach((b) => lines.push(`  - ${b}`));
    }
    lines.push('Product description:');
    lines.push(input.prompt.trim());
    lines.push(
      'Return the JSON now. Do not include any text before or after the JSON object.',
    );
    return lines.join('\n');
  }

  private parseCopyJson(
    raw: string,
    input: SalesPageGenerateInput,
    language: LanguageKey,
  ): SalesPageCopy | null {
    const body = this.extractJson(raw);
    if (!body) return null;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;

    const str = (v: unknown, fallback = ''): string =>
      typeof v === 'string' ? v.trim() : fallback;
    const strList = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
        : [];
    const obj = (v: unknown): Record<string, unknown> =>
      v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

    const title =
      str(parsed.title) || input.title || input.productName || 'Sua solução';
    const headline = str(parsed.headline) || title;
    const subheadline =
      str(parsed.subheadline) ||
      'Uma oferta feita pra quem quer resultados reais, sem enrolação.';
    const primaryCta =
      str(parsed.primaryCta) || input.cta || 'Quero garantir meu acesso';

    const benefits = (Array.isArray(parsed.benefits) ? parsed.benefits : [])
      .map((b) => {
        const o = obj(b);
        const t = str(o.title);
        const d = str(o.description);
        if (!t && !d) return null;
        return { title: t || d, description: d || t };
      })
      .filter((v): v is { title: string; description: string } => Boolean(v));

    const bonuses: SalesPageBonus[] = (
      Array.isArray(parsed.bonuses) ? parsed.bonuses : []
    )
      .map((b): SalesPageBonus | null => {
        const o = obj(b);
        const t = str(o.title);
        const d = str(o.description);
        if (!t && !d) return null;
        return {
          title: t || d,
          description: d || t,
          valueLine: str(o.valueLine) || undefined,
        };
      })
      .filter((v): v is SalesPageBonus => v !== null);

    const testimonials: SalesPageTestimonial[] = (
      Array.isArray(parsed.testimonials) ? parsed.testimonials : []
    )
      .map((tm): SalesPageTestimonial | null => {
        const o = obj(tm);
        const quote = str(o.quote);
        const author = str(o.author);
        if (!quote || !author) return null;
        return {
          quote,
          author,
          role: str(o.role) || undefined,
          result: str(o.result) || undefined,
        };
      })
      .filter((v): v is SalesPageTestimonial => v !== null);

    const faq = (Array.isArray(parsed.faq) ? parsed.faq : [])
      .map((f) => {
        const o = obj(f);
        const question = str(o.question);
        const answer = str(o.answer);
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((v): v is { question: string; answer: string } => Boolean(v));

    const proofStats = (
      Array.isArray(parsed.proofStats) ? parsed.proofStats : []
    )
      .map((s) => {
        const o = obj(s);
        const value = str(o.value);
        const label = str(o.label);
        if (!value || !label) return null;
        return { value, label };
      })
      .filter((v): v is { value: string; label: string } => Boolean(v));

    const mechanismObj = obj(parsed.uniqueMechanism);
    const uniqueMechanism = str(mechanismObj.title)
      ? {
          title: str(mechanismObj.title),
          description:
            str(mechanismObj.description) ||
            'Um método passo a passo testado em centenas de casos reais.',
          steps: strList(mechanismObj.steps),
        }
      : undefined;

    const authorityObj = obj(parsed.authorityBio);
    const authorityBio = str(authorityObj.name)
      ? {
          name: str(authorityObj.name),
          role: str(authorityObj.role) || undefined,
          bio: str(authorityObj.bio) || '',
          credentials: strList(authorityObj.credentials),
        }
      : undefined;

    const urgencyObj = obj(parsed.urgency);
    const urgency = str(urgencyObj.headline)
      ? {
          headline: str(urgencyObj.headline),
          body: str(urgencyObj.body) || '',
        }
      : undefined;

    const offerObj = obj(parsed.offer);
    const offerBullets = strList(offerObj.bullets);
    const offer = {
      title: str(offerObj.title) || 'Acesso completo',
      priceLine:
        str(offerObj.priceLine) ||
        input.priceOffer ||
        '12x sem juros · Acesso vitalício',
      bullets: offerBullets.length
        ? offerBullets
        : benefits.slice(0, 6).map((b) => b.title),
      guarantee:
        str(offerObj.guarantee) ||
        input.guarantee ||
        '7 dias de garantia incondicional',
    };

    return {
      title,
      kicker: str(parsed.kicker) || undefined,
      headline,
      subheadline,
      storyHook: str(parsed.storyHook) || undefined,
      primaryCta,
      secondaryCta: str(parsed.secondaryCta) || undefined,
      painPoints: strList(parsed.painPoints),
      agitation: strList(parsed.agitation),
      uniqueMechanism,
      benefits: benefits.length
        ? benefits
        : this.buildFallbackCopy({
            ...input,
            tone: 'confident',
            language,
          }).benefits,
      bonuses: bonuses.length ? bonuses : undefined,
      proofStats: proofStats.length ? proofStats : undefined,
      authorityBio,
      urgency,
      offer,
      testimonials,
      faq,
      footerNote: str(parsed.footerNote) || undefined,
      productName: input.productName || title,
      language,
    };
  }

  private extractJson(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) return trimmed;
    const fence = /```json\s*([\s\S]*?)\s*```/i.exec(trimmed);
    if (fence) return fence[1].trim();
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
    return null;
  }

  private buildFallbackCopy(
    input: SalesPageGenerateInput & {
      tone: ToneKey;
      language: LanguageKey;
    },
  ): SalesPageCopy {
    const lang = input.language;
    const productName =
      input.productName ||
      this.inferProductName(input.prompt) ||
      (lang === 'pt-BR'
        ? 'Nosso Produto'
        : lang === 'es-ES'
          ? 'Nuestro Producto'
          : 'Our Product');
    const title = input.title || productName;

    // Language packs
    const pack = this.fallbackPack(lang, input);

    return {
      title,
      kicker: pack.kicker,
      headline: pack.headline,
      subheadline: pack.sub,
      storyHook: pack.storyHook,
      primaryCta: input.cta || pack.cta,
      painPoints: pack.pain,
      agitation: pack.agitation,
      uniqueMechanism: {
        title: input.uniqueMechanism
          ? pack.mechanismNameFrom(input.uniqueMechanism)
          : pack.mechanismName,
        description: input.uniqueMechanism || pack.mechanismDesc,
        steps: pack.mechanismSteps,
      },
      benefits: pack.benefits,
      bonuses: (input.bonuses ?? []).length
        ? input.bonuses!.map((b) => ({
            title: b,
            description: pack.bonusDefaultDesc,
            valueLine: pack.bonusValueLine,
          }))
        : pack.bonuses,
      proofStats: pack.proofStats,
      authorityBio:
        input.authorName || input.authorBio
          ? {
              name: input.authorName || pack.authorName,
              role: input.authorRole || pack.authorRole,
              bio: input.authorBio || pack.authorBio,
              credentials: input.proofPoints?.length
                ? input.proofPoints
                : pack.credentials,
            }
          : undefined,
      urgency: input.urgencyHook
        ? {
            headline: input.urgencyHook,
            body: pack.urgencyBody,
          }
        : pack.urgency,
      offer: {
        title: pack.offerTitle,
        priceLine: input.priceOffer || pack.price,
        bullets: pack.offerBullets,
        guarantee: input.guarantee || pack.guarantee,
      },
      testimonials: pack.testimonials,
      faq: (input.objections ?? []).length
        ? input.objections!.map((q) => ({
            question: q,
            answer: pack.fallbackFaqAnswer,
          }))
        : pack.faq,
      footerNote: pack.footer,
      productName,
      language: lang,
    };
  }

  private inferProductName(prompt: string): string | null {
    if (!prompt) return null;
    const first = (prompt.trim().split(/[\n.!?]/)[0] ?? '').trim();
    const words = first.split(/\s+/).filter(Boolean).slice(0, 5);
    if (!words.length) return null;
    const cleaned = words
      .join(' ')
      .replace(/[^\p{L}\p{N}\s\-_']/gu, '')
      .trim();
    return cleaned.length >= 3 ? cleaned.slice(0, 80) : null;
  }

  private fallbackPack(lang: LanguageKey, input: SalesPageGenerateInput) {
    const niche = input.niche ?? '';
    if (lang === 'en-US') {
      return {
        kicker: niche
          ? `For people serious about ${niche}`
          : 'Built for real results',
        headline:
          input.promise ||
          (niche
            ? `The simplest path to ${niche}`
            : 'The direct path to the result you want'),
        sub: input.audience
          ? `Built for ${input.audience}. Focused, practical, fully supported.`
          : 'Focused, practical, with the support of people who already walked the path.',
        storyHook:
          'Most programs leave you alone after day 1. Ours does the exact opposite.',
        cta: 'Get instant access',
        pain: [
          'You have tried everything and nothing delivered what it promised.',
          'You need a clear, no-guesswork plan that fits your schedule.',
          'You are done wasting time on generic, cookie-cutter solutions.',
        ],
        agitation: [
          'Every week you postpone, the problem compounds — and so does the frustration.',
          'The real cost is not the money on courses you never finished — it is the years you lost.',
        ],
        mechanismName: 'The 3-Phase Acceleration Method',
        mechanismNameFrom: (_s: string) => 'The Custom Acceleration Method',
        mechanismDesc:
          'A step-by-step system tested with hundreds of real cases. You skip the trial-and-error and go straight to what works.',
        mechanismSteps: [
          'Diagnose: understand exactly where you are and what is blocking you.',
          'Rebuild: install the daily habits that move the needle for your case.',
          'Scale: leverage what works and compound results week over week.',
        ],
        benefits: [
          {
            title: 'Step-by-step plan',
            description: 'A clear path, no fluff, no theory bloat.',
          },
          {
            title: 'Human support',
            description: 'Fast, specific answers for your exact situation.',
          },
          {
            title: 'Results in weeks',
            description: 'Focus on what moves the needle — nothing else.',
          },
          {
            title: 'Always up to date',
            description: 'You grow alongside the program.',
          },
        ],
        bonuses: [
          {
            title: 'Private accountability community',
            description: 'Daily check-ins and peer support.',
            valueLine: 'Value: $297',
          },
          {
            title: 'Monthly live Q&A',
            description: 'Direct access to the lead mentor.',
            valueLine: 'Value: $497',
          },
        ],
        bonusDefaultDesc: 'Included free when you join today.',
        bonusValueLine: 'Value included',
        proofStats: [
          { value: '+5,000', label: 'Students onboarded' },
          { value: '97%', label: 'Satisfaction' },
          { value: '30 days', label: 'First visible results' },
        ],
        authorName: 'The Founders',
        authorRole: 'Lead mentors',
        authorBio:
          'Built from 10+ years of hands-on work, refined with every single cohort.',
        credentials: [
          '10+ years of industry experience',
          'Taught in 20+ countries',
          'Featured in major outlets',
        ],
        urgency: {
          headline: 'Limited enrollment this week',
          body: 'We only open a few spots per month to keep the support quality high.',
        },
        urgencyBody:
          'We only open a few spots per month to keep the support quality high.',
        offerTitle: 'Complete program access',
        price: 'Lifetime access · one-time payment',
        offerBullets: [
          'Instant access to the full platform',
          'Exclusive student community',
          'Hands-on lessons with real-world examples',
          'Free updates forever',
        ],
        guarantee: '7-day unconditional guarantee',
        testimonials: [
          {
            quote:
              'In 30 days I shipped things I had been postponing for years.',
            author: 'Chris R.',
            role: 'Student',
            result: '+40% in the first month',
          },
          {
            quote:
              'The support is next level. Whenever I got stuck, someone unstuck me the same day.',
            author: 'Phil A.',
            role: 'Student',
            result: 'Finished in 6 weeks',
          },
          {
            quote:
              'Finally something that worked with my routine. No fluff, just clear steps.',
            author: 'Sam T.',
            role: 'Student',
            result: '3x faster than expected',
          },
        ],
        faq: [
          {
            question: 'How fast will I see results?',
            answer:
              'Students who apply the method usually notice changes in the first weeks.',
          },
          {
            question: 'Will it work for my specific case?',
            answer:
              'Yes. The method is adaptable, and you get support to fit it to your context.',
          },
          {
            question: 'How does the guarantee work?',
            answer: 'You have 7 days to try risk-free. Not happy? 100% refund.',
          },
          {
            question: 'Do I need experience?',
            answer: 'No. The program is built so beginners can follow along.',
          },
        ],
        fallbackFaqAnswer:
          'Yes — we cover exactly this in the program, and support is available if you get stuck.',
        footer:
          'This site is not affiliated with Facebook or any other entity.',
      };
    }
    if (lang === 'es-ES') {
      return {
        kicker: niche
          ? `Para quienes van en serio con ${niche}`
          : 'Hecho para resultados reales',
        headline:
          input.promise ||
          (niche
            ? `El camino más simple para ${niche}`
            : 'El camino directo al resultado que buscas'),
        sub: input.audience
          ? `Creado para ${input.audience}. Directo, práctico y con acompañamiento.`
          : 'Directo, práctico y con el respaldo de quienes ya hicieron el camino.',
        storyHook:
          'La mayoría de los programas te dejan solo después del primer día. El nuestro hace exactamente lo contrario.',
        cta: 'Quiero comprar ahora',
        pain: [
          'Has probado de todo y nada entrega lo que promete.',
          'Necesitas un plan claro, sin adivinar, que encaje en tu rutina.',
          'No quieres seguir perdiendo tiempo con soluciones genéricas.',
        ],
        agitation: [
          'Cada semana que lo pospones, el problema crece — y la frustración también.',
          'El costo real no es el dinero en cursos que no terminaste — son los años que perdiste.',
        ],
        mechanismName: 'Método de Aceleración en 3 Fases',
        mechanismNameFrom: () => 'Método a Medida',
        mechanismDesc:
          'Un sistema paso a paso probado en cientos de casos reales. Te saltas el ensayo y error y vas directo a lo que funciona.',
        mechanismSteps: [
          'Diagnóstico: entiende exactamente dónde estás y qué te bloquea.',
          'Reconstrucción: instala los hábitos diarios que mueven la aguja en tu caso.',
          'Escala: amplifica lo que funciona y multiplica resultados.',
        ],
        benefits: [
          {
            title: 'Plan paso a paso',
            description: 'Un camino claro, sin relleno.',
          },
          {
            title: 'Soporte humano',
            description: 'Respuestas rápidas y específicas para tu caso.',
          },
          {
            title: 'Resultados en semanas',
            description: 'Enfoque en lo que mueve la aguja.',
          },
          {
            title: 'Siempre actualizado',
            description: 'Creces junto al programa.',
          },
        ],
        bonuses: [
          {
            title: 'Comunidad privada de responsabilidad',
            description: 'Check-ins diarios y apoyo entre pares.',
            valueLine: 'Valor: U$S 297',
          },
          {
            title: 'Q&A en vivo mensual',
            description: 'Acceso directo al mentor principal.',
            valueLine: 'Valor: U$S 497',
          },
        ],
        bonusDefaultDesc: 'Incluido gratis al inscribirte hoy.',
        bonusValueLine: 'Valor incluido',
        proofStats: [
          { value: '+5.000', label: 'Alumnos' },
          { value: '97%', label: 'Satisfacción' },
          { value: '30 días', label: 'Primeros resultados' },
        ],
        authorName: 'Los Fundadores',
        authorRole: 'Mentores principales',
        authorBio:
          'Construido con más de 10 años de experiencia práctica, refinado con cada promoción.',
        credentials: [
          'Más de 10 años de experiencia',
          'Alumnos en más de 20 países',
          'Destacados en medios importantes',
        ],
        urgency: {
          headline: 'Inscripción limitada esta semana',
          body: 'Abrimos pocos cupos al mes para mantener la calidad del soporte.',
        },
        urgencyBody:
          'Abrimos pocos cupos al mes para mantener la calidad del soporte.',
        offerTitle: 'Acceso completo al programa',
        price: 'Acceso de por vida · pago único',
        offerBullets: [
          'Acceso inmediato a toda la plataforma',
          'Comunidad exclusiva de alumnos',
          'Clases prácticas con ejemplos reales',
          'Actualizaciones gratis para siempre',
        ],
        guarantee: '7 días de garantía incondicional',
        testimonials: [
          {
            quote: 'En 30 días logré cosas que venía postergando hace años.',
            author: 'Carla R.',
            role: 'Alumna',
            result: '+40% el primer mes',
          },
          {
            quote:
              'El soporte es otro nivel. Siempre que me trababa, alguien me ayudaba el mismo día.',
            author: 'Felipe A.',
            role: 'Alumno',
            result: 'Terminado en 6 semanas',
          },
          {
            quote:
              'Por fin algo que encajó con mi rutina. Sin relleno, pasos claros.',
            author: 'Sol T.',
            role: 'Alumna',
            result: '3x más rápido',
          },
        ],
        faq: [
          {
            question: '¿En cuánto tiempo veo resultados?',
            answer:
              'Los alumnos que aplican el método suelen notar cambios en las primeras semanas.',
          },
          {
            question: '¿Funciona para mi caso?',
            answer:
              'Sí. El método se adapta y tienes soporte para ajustarlo a tu contexto.',
          },
          {
            question: '¿Cómo funciona la garantía?',
            answer:
              'Tienes 7 días para probar sin riesgo. Si no te gusta, devolvemos el 100%.',
          },
          {
            question: '¿Necesito experiencia?',
            answer:
              'No. El programa está pensado para que principiantes lo sigan sin problema.',
          },
        ],
        fallbackFaqAnswer:
          'Sí — lo cubrimos exactamente en el programa, y hay soporte disponible si te trabas.',
        footer:
          'Este sitio no está afiliado a Facebook ni a ninguna otra entidad.',
      };
    }
    // pt-BR
    return {
      kicker: niche
        ? `Para quem quer ${niche} de verdade`
        : 'Feito pra quem busca resultado real',
      headline:
        input.promise ||
        (niche
          ? `O caminho mais simples para ${niche}`
          : 'O caminho mais direto até o resultado que você quer'),
      sub: input.audience
        ? `Um programa pensado para ${input.audience}. Direto ao ponto, prático e com suporte de quem já trilhou.`
        : 'Direto ao ponto, prático e com suporte de quem já trilhou o caminho.',
      storyHook:
        'A maioria dos programas te abandona depois do primeiro dia. O nosso faz exatamente o oposto.',
      cta: 'Quero garantir meu acesso',
      pain: [
        'Você já tentou de tudo e nada entrega o resultado prometido.',
        'Falta um plano claro, sem achismo, que caiba na sua rotina.',
        'Você não quer mais perder tempo com soluções genéricas e enlatadas.',
      ],
      agitation: [
        'Cada semana que você empurra com a barriga, o problema cresce — e a frustração também.',
        'O custo real não é o dinheiro em cursos que você não terminou — são os anos que você perdeu.',
      ],
      mechanismName: 'Método de Aceleração em 3 Fases',
      mechanismNameFrom: () => 'Método Sob Medida',
      mechanismDesc:
        'Um sistema passo a passo testado em centenas de casos reais. Você pula o tentativa-e-erro e vai direto pro que funciona.',
      mechanismSteps: [
        'Diagnóstico: entender exatamente onde você está e o que te trava.',
        'Reconstrução: instalar os hábitos diários que movem o ponteiro no seu caso.',
        'Escala: amplificar o que funciona e multiplicar resultados semana após semana.',
      ],
      benefits: [
        {
          title: 'Plano passo a passo',
          description: 'Um caminho claro, sem volta, sem teoria demais.',
        },
        {
          title: 'Suporte humano',
          description: 'Respostas rápidas e específicas pra sua realidade.',
        },
        {
          title: 'Resultados em poucas semanas',
          description: 'Foco no que move o ponteiro, sem encheção de linguiça.',
        },
        {
          title: 'Atualizações contínuas',
          description: 'Você evolui junto com o programa.',
        },
      ],
      bonuses: [
        {
          title: 'Comunidade privada de responsabilidade',
          description: 'Check-ins diários e apoio dos colegas.',
          valueLine: 'Valor: R$ 497',
        },
        {
          title: 'Q&A ao vivo mensal',
          description: 'Acesso direto ao mentor principal.',
          valueLine: 'Valor: R$ 997',
        },
      ],
      bonusDefaultDesc: 'Incluso gratuitamente ao se inscrever hoje.',
      bonusValueLine: 'Valor incluso',
      proofStats: [
        { value: '+5.000', label: 'Alunos formados' },
        { value: '97%', label: 'Satisfação' },
        { value: '30 dias', label: 'Primeiros resultados' },
      ],
      authorName: 'Os Fundadores',
      authorRole: 'Mentores principais',
      authorBio:
        'Construído com mais de 10 anos de experiência prática, refinado com cada turma.',
      credentials: [
        '10+ anos de experiência na área',
        'Alunos em mais de 20 países',
        'Destacado em grandes veículos',
      ],
      urgency: {
        headline: 'Inscrições limitadas nesta semana',
        body: 'Abrimos poucas vagas por mês pra manter a qualidade do suporte.',
      },
      urgencyBody:
        'Abrimos poucas vagas por mês pra manter a qualidade do suporte.',
      offerTitle: 'Acesso completo ao programa',
      price: 'Acesso vitalício · pagamento único',
      offerBullets: [
        'Acesso imediato a toda a plataforma',
        'Comunidade exclusiva de alunos',
        'Aulas práticas com exemplos reais',
        'Atualizações gratuitas para sempre',
      ],
      guarantee: '7 dias de garantia incondicional',
      testimonials: [
        {
          quote:
            'Em 30 dias, coisas que eu vinha empurrando há anos finalmente saíram do papel.',
          author: 'Camila R.',
          role: 'Aluna',
          result: '+40% no primeiro mês',
        },
        {
          quote:
            'O suporte é outro nível. Sempre que travava, alguém me tirava do buraco no mesmo dia.',
          author: 'Felipe A.',
          role: 'Aluno',
          result: 'Concluído em 6 semanas',
        },
        {
          quote:
            'Finalmente algo que funcionou com a minha rotina. Sem enrolação, passo a passo claro.',
          author: 'Marina T.',
          role: 'Aluna',
          result: '3x mais rápido que o esperado',
        },
      ],
      faq: [
        {
          question: 'Em quanto tempo começo a ver resultados?',
          answer:
            'Alunos que aplicam de fato costumam notar mudanças nas primeiras semanas.',
        },
        {
          question: 'Serve pro meu caso específico?',
          answer:
            'Sim. O método é adaptável — e você tem suporte pra calibrar ao seu contexto.',
        },
        {
          question: 'Como funciona a garantia?',
          answer:
            'Você tem 7 dias para testar sem risco. Se não gostar, devolvemos 100% do valor.',
        },
        {
          question: 'Preciso de experiência?',
          answer:
            'Não. O programa foi feito pra que iniciantes consigam acompanhar.',
        },
      ],
      fallbackFaqAnswer:
        'Sim — cobrimos exatamente isso dentro do programa, e você tem suporte quando travar.',
      footer:
        'Este site não é afiliado ao Facebook ou a qualquer outra entidade.',
    };
  }
}
