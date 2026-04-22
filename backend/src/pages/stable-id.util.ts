import { load, type CheerioAPI, type Cheerio } from 'cheerio';
import type { Element as CheerioElement } from 'domhandler';

/**
 * Stable identity layer for cloned HTML.
 *
 * Goal: every interactive or editable element receives a deterministic
 * `data-criaai-id`. The same LOGICAL element produces the same id even when:
 *   - decorative wrappers are added/removed by the SPA
 *   - siblings like progress bars, tooltips, analytics pixels are injected
 *   - text numeric tokens (counters, timers, "3/10") change
 *   - class names are toggled (selected, active, hover)
 *
 * Strategy: compute a signature from
 *   (a) tag
 *   (b) nearest "semantic ancestor chain" — only ancestors that have an
 *       intrinsic identity (id, data-testid, data-cy, role, aria-label, or a
 *       form/section/nav/main tag). We skip ALL plain <div>/<span> wrappers.
 *   (c) for each ancestor in that chain, the same-tag-index among its semantic
 *       siblings (NOT global sibling index)
 *   (d) intrinsic attribute hint on the element itself (id/name/data-testid)
 *   (e) a NORMALIZED text fingerprint: lowercased, whitespace-collapsed,
 *       with all digit runs replaced by `#` — so "Step 4 of 20" == "Step # of #".
 *
 * This file is ISOMORPHIC: the `STABLE_ID_BROWSER_JS` export re-implements the
 * SAME algorithm inside a page.evaluate string so Cheerio (capture pipeline)
 * and Playwright DOM agree bit-for-bit on the resulting ids.
 */

export const EDITABLE_SELECTOR =
  'h1,h2,h3,h4,h5,h6,p,span,li,a,button,label,strong,em,small,blockquote,img,video,iframe,figcaption';

export const INTERACTIVE_SELECTOR =
  'a,button,[role="button"],[role="radio"],[role="option"],[role="tab"],[role="checkbox"],[role="switch"],input[type="submit"],input[type="button"],input[type="radio"],input[type="checkbox"],label,summary,[data-testid],[data-cy]';

export const CRIAAI_ID_ATTR = 'data-criaai-id';

const SEMANTIC_TAGS = new Set([
  'form',
  'section',
  'nav',
  'main',
  'article',
  'aside',
  'header',
  'footer',
  'fieldset',
  'dialog',
  'ul',
  'ol',
  'table',
  'tr',
]);

export function injectStableIds(html: string): string {
  if (!html) return html;
  const $ = load(html);
  injectStableIdsOnCheerio($);
  return $.html();
}

export function injectStableIdsOnCheerio($: CheerioAPI): void {
  const editableSet = new Set<CheerioElement>();
  const interactiveSet = new Set<CheerioElement>();

  $(EDITABLE_SELECTOR).each((_, el) => {
    editableSet.add(el as CheerioElement);
  });
  $(INTERACTIVE_SELECTOR).each((_, el) => {
    interactiveSet.add(el as CheerioElement);
  });

  const assigned = new Set<string>();

  const processNode = (el: Cheerio<CheerioElement>, kind: 'e' | 'i') => {
    const node = el.get(0) as CheerioElement;
    if (!node || !node.tagName) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body' || tag === 'head') return;
    if (el.attr(CRIAAI_ID_ATTR)) return;
    const sig = buildCheerioSignature($, el, kind);
    const rawId = `${kind}-${fnv1a9(sig)}`;
    let id = rawId;
    let collision = 0;
    while (assigned.has(id)) {
      collision += 1;
      id = `${rawId}${collision.toString(36)}`;
    }
    assigned.add(id);
    el.attr(CRIAAI_ID_ATTR, id);
  };

  // Process editable first so text nodes dominate ids; interactive then
  // adds to the rest (buttons etc. already covered by both typically).
  editableSet.forEach((node) => processNode($(node), 'e'));
  interactiveSet.forEach((node) => {
    if (!$(node).attr(CRIAAI_ID_ATTR)) processNode($(node), 'i');
  });
}

/**
 * Browser version of the same algorithm — serialized as a string for use
 * inside `page.evaluate`. Anything mutated here lands back in the capture
 * HTML because Playwright then grabs `document.documentElement.outerHTML`.
 */
export const STABLE_ID_BROWSER_JS = `
(() => {
  const EDITABLE_SELECTOR = ${JSON.stringify(EDITABLE_SELECTOR)};
  const INTERACTIVE_SELECTOR = ${JSON.stringify(INTERACTIVE_SELECTOR)};
  const ATTR = ${JSON.stringify(CRIAAI_ID_ATTR)};
  const SEMANTIC_TAGS = new Set(${JSON.stringify(Array.from(SEMANTIC_TAGS))});
  const assigned = new Set();
  document.querySelectorAll('[' + ATTR + ']').forEach((n) => {
    assigned.add(n.getAttribute(ATTR));
  });

  const fnv1a9 = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36).padStart(7, '0').slice(0, 9);
  };

  const isSemantic = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (SEMANTIC_TAGS.has(tag)) return true;
    if (el.id) return true;
    if (el.getAttribute('data-testid')) return true;
    if (el.getAttribute('data-cy')) return true;
    if (el.getAttribute('role')) return true;
    if (el.getAttribute('aria-label')) return true;
    return false;
  };

  const normalizeText = (raw) => {
    if (!raw) return '';
    return String(raw)
      .toLowerCase()
      .replace(/\\d+/g, '#')
      .replace(/[\\s\\u00a0]+/g, ' ')
      .replace(/[^a-z#@\\- _]/g, '')
      .trim()
      .slice(0, 60);
  };

  const semanticHint = (el) => {
    const tag = (el.tagName || '').toLowerCase();
    const hint =
      el.getAttribute('data-testid') ||
      el.getAttribute('data-cy') ||
      el.id ||
      el.getAttribute('role') ||
      el.getAttribute('aria-label') ||
      '';
    return tag + (hint ? ':' + String(hint).slice(0, 24) : '');
  };

  const sameSemanticIndex = (el, parent) => {
    if (!parent) return 0;
    const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
    const idx = siblings.indexOf(el);
    return idx < 0 ? 0 : idx;
  };

  const buildSignature = (node, kind) => {
    const ancestors = [];
    let cur = node.parentElement;
    let depth = 0;
    while (cur && cur !== document.body && cur !== document.documentElement && depth < 40) {
      if (isSemantic(cur)) {
        const parent = cur.parentElement;
        const idx = sameSemanticIndex(cur, parent);
        ancestors.unshift(semanticHint(cur) + '@' + idx);
      }
      cur = cur.parentElement;
      depth += 1;
    }
    const parent = node.parentElement;
    const selfIdx = sameSemanticIndex(node, parent);
    const tagName = (node.tagName || '').toLowerCase();
    const hint = semanticHint(node);
    const label = normalizeText(node.textContent || '') ||
      normalizeText(node.getAttribute('aria-label') || node.getAttribute('title') || node.getAttribute('placeholder') || '');
    return kind + '|' + ancestors.join('>') + '|' + hint + '@' + selfIdx + '|' + tagName + '|' + label;
  };

  const assign = (node, kind) => {
    if (!node || node.nodeType !== 1) return;
    const tag = (node.tagName || '').toLowerCase();
    if (tag === 'html' || tag === 'body' || tag === 'head') return;
    if (node.hasAttribute(ATTR)) return;
    const sig = buildSignature(node, kind);
    const base = kind + '-' + fnv1a9(sig);
    let id = base;
    let col = 0;
    while (assigned.has(id)) {
      col += 1;
      id = base + col.toString(36);
    }
    assigned.add(id);
    node.setAttribute(ATTR, id);
  };

  document.querySelectorAll(EDITABLE_SELECTOR).forEach((n) => assign(n, 'e'));
  document.querySelectorAll(INTERACTIVE_SELECTOR).forEach((n) => assign(n, 'i'));
})();
`;

function fnv1a9(str: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).padStart(7, '0').slice(0, 9);
}

function isSemanticCheerio(
  $: CheerioAPI,
  el: Cheerio<CheerioElement>,
): boolean {
  const node = el.get(0) as CheerioElement | undefined;
  if (!node || !node.tagName) return false;
  const tag = node.tagName.toLowerCase();
  if (SEMANTIC_TAGS.has(tag)) return true;
  if (el.attr('id')) return true;
  if (el.attr('data-testid')) return true;
  if (el.attr('data-cy')) return true;
  if (el.attr('role')) return true;
  if (el.attr('aria-label')) return true;
  return false;
}

export function normalizeForSignature(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/[^a-z#@\- _]/g, '')
    .trim()
    .slice(0, 60);
}

function semanticHintCheerio(el: Cheerio<CheerioElement>): string {
  const node = el.get(0) as CheerioElement | undefined;
  const tag = node?.tagName?.toLowerCase() ?? '';
  const hint =
    el.attr('data-testid') ??
    el.attr('data-cy') ??
    el.attr('id') ??
    el.attr('role') ??
    el.attr('aria-label') ??
    '';
  return tag + (hint ? `:${String(hint).slice(0, 24)}` : '');
}

function sameSemanticIndexCheerio(el: Cheerio<CheerioElement>): number {
  const node = el.get(0) as CheerioElement | undefined;
  if (!node) return 0;
  const parent = el.parent();
  if (!parent.length) return 0;
  const siblings = (parent.children().toArray() as CheerioElement[]).filter(
    (c) => c.tagName === node.tagName,
  );
  const idx = siblings.indexOf(node);
  return idx < 0 ? 0 : idx;
}

function buildCheerioSignature(
  $: CheerioAPI,
  el: Cheerio<CheerioElement>,
  kind: 'e' | 'i',
): string {
  const ancestors: string[] = [];
  let cur: Cheerio<CheerioElement> = el.parent();
  let depth = 0;
  while (cur.length && depth < 40) {
    const node = cur.get(0) as CheerioElement | undefined;
    if (!node || !node.tagName) break;
    const tag = node.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body') break;
    if (isSemanticCheerio($, cur)) {
      const idx = sameSemanticIndexCheerio(cur);
      ancestors.unshift(`${semanticHintCheerio(cur)}@${idx}`);
    }
    cur = cur.parent();
    depth += 1;
  }
  const selfIdx = sameSemanticIndexCheerio(el);
  const tagName =
    (el.get(0) as CheerioElement | undefined)?.tagName?.toLowerCase() ?? '';
  const hint = semanticHintCheerio(el);
  const rawLabel =
    el.text() ||
    el.attr('aria-label') ||
    el.attr('title') ||
    el.attr('placeholder') ||
    '';
  const label = normalizeForSignature(rawLabel);
  return [kind, ancestors.join('>'), `${hint}@${selfIdx}`, tagName, label].join(
    '|',
  );
}

export function ensureStableId(
  $: CheerioAPI,
  el: Cheerio<CheerioElement>,
  kind: 'e' | 'i' = 'i',
): string {
  const existing = el.attr(CRIAAI_ID_ATTR);
  if (existing) return existing;
  const sig = buildCheerioSignature($, el, kind);
  const id = `${kind}-${fnv1a9(sig)}`;
  el.attr(CRIAAI_ID_ATTR, id);
  return id;
}
