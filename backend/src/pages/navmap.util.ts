import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element as CheerioElement } from 'domhandler';
import { CRIAAI_ID_ATTR } from './stable-id.util';

export interface NavigationEdge {
  fromStepId: string;
  selector: string;
  toStepId: string;
  triggerText?: string;
  /**
   * Preferred, version-stable identity of the clicked element
   * (data-criaai-id attribute value). When present, this is used as the
   * primary lookup during navigation rewriting — CSS selectors remain as
   * fallback for older edges that were recorded before stable ids existed.
   */
  actionId?: string;
}

export type StepResolver = (toStepId: string) => string;

/**
 * Rewrites the HTML of a given step so that the buttons/links the user clicked
 * to navigate forward in the original quiz now point to the provided target URL
 * (subdomain route or neighbor .html file).
 *
 * Strategy:
 *  - For each edge fromStepId === stepId, locate element via CSS selector.
 *  - If element is an <a>, set href to resolver(toStepId).
 *  - Otherwise, wrap element in an <a href>. If already inside an <a>, update parent.
 *  - Add a data-criaai-nav attribute for debugging/inspection.
 *  - Neutralize any remaining external navigation that might leak (form submits,
 *    external anchors) to avoid losing the user during the cloned flow.
 */
export function rewriteNavigation(
  html: string,
  stepId: string,
  navigationMap: NavigationEdge[],
  resolver: StepResolver,
  options?: { neutralizeExternal?: boolean },
): string {
  const $ = load(html);
  const edges = navigationMap.filter((edge) => edge.fromStepId === stepId);
  const OPTION_LIKE_SELECTOR =
    'button.option-theme, button[class*="option" i], [role="radio"], [role="option"], label';

  const applyDestination = (
    target: Cheerio<CheerioElement> | Cheerio<unknown>,
    toStepId: string,
    destination: string,
  ): void => {
    const $target = target as unknown as Cheerio<CheerioElement>;
    const tagName = (
      $target.get(0) as { tagName?: string } | undefined
    )?.tagName?.toLowerCase();
    $target.attr('data-criaai-nav', toStepId);
    stripInterceptingHandlers($, $target);

    if (tagName === 'a') {
      $target.attr('href', destination);
      $target.removeAttr('target');
      $target.attr('data-href', destination);
      return;
    }

    const parentAnchor = $target.closest('a');
    if (parentAnchor.length) {
      parentAnchor.attr('href', destination);
      parentAnchor.removeAttr('target');
      parentAnchor.attr('data-href', destination);
      stripInterceptingHandlers($, parentAnchor);
      return;
    }

    const escaped = destination
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const onclickJs = `window.location.href='${destination.replace(/'/g, "\\'")}';return false;`;
    const innerHtml = $.html($target);
    $target.replaceWith(
      `<a href="${escaped}" data-href="${escaped}" data-criaai-wrap="${toStepId}" onclick="${onclickJs}" style="color:inherit;text-decoration:none;display:contents;">${innerHtml}</a>`,
    );
  };

  for (const edge of edges) {
    let target = edge.actionId
      ? $(`[${CRIAAI_ID_ATTR}="${edge.actionId}"]`).first()
      : $('');
    if (!target.length && edge.selector) {
      try {
        target = $(edge.selector).first();
      } catch {
        target = $('');
      }
    }
    if (!target.length && edge.triggerText) {
      const needle = edge.triggerText.toLowerCase().replace(/\s+/g, ' ').trim();
      $(
        'a, button, [role="button"], label, [role="radio"], [role="option"]',
      ).each((_, raw) => {
        if (target.length) return;
        const el = $(raw);
        const text = el.text().toLowerCase().replace(/\s+/g, ' ').trim();
        if (text && text === needle) target = el;
      });
    }
    if (!target.length) continue;
    const destination = resolver(edge.toStepId);
    if (!destination) continue;

    applyDestination(target, edge.toStepId, destination);

    // Heuristic propagation for option lists:
    // If the navigation map only captured one option in a radio-like group,
    // export all sibling options with the same destination so offline ZIP
    // navigation doesn't "work only on first option".
    const targetNode = target.get(0);
    if (!targetNode) continue;
    let groupRoot: Cheerio<CheerioElement> | null = null;
    let walker = target as Cheerio<CheerioElement>;
    for (let depth = 0; depth < 8; depth += 1) {
      walker = walker.parent();
      if (!walker.length) break;
      let peers: CheerioElement[] = [];
      try {
        peers = walker.find(OPTION_LIKE_SELECTOR).toArray();
      } catch {
        peers = [];
      }
      if (peers.length >= 2 && peers.includes(targetNode as CheerioElement)) {
        groupRoot = walker;
        break;
      }
    }
    if (!groupRoot) continue;
    const siblings = groupRoot.find(OPTION_LIKE_SELECTOR).toArray();
    for (const raw of siblings) {
      if (raw === targetNode) continue;
      const peer = $(raw);
      if (
        peer.attr('data-criaai-nav') ||
        peer.closest('[data-criaai-wrap]').length
      ) {
        continue;
      }
      applyDestination(peer, edge.toStepId, destination);
    }
  }

  if (options?.neutralizeExternal) {
    $('form').each((_, el) => {
      const $el = $(el);
      $el.attr('onsubmit', 'return false;');
      $el.removeAttr('action');
    });
  }

  return $.html();
}

/**
 * Removes attributes that the original SPA used to intercept clicks/submits
 * and defer to its own client-side router. After cloning, that router
 * doesn't exist, so the listeners just preventDefault() and silently break
 * navigation. Stripping them lets the wrapped `<a href>` (or the rewritten
 * href) take over cleanly.
 */
function stripInterceptingHandlers(
  _$: CheerioAPI,
  el: Cheerio<CheerioElement> | Cheerio<unknown>,
): void {
  const $el = el as unknown as Cheerio<CheerioElement>;
  const handlerAttrs = [
    'onclick',
    'onmousedown',
    'onmouseup',
    'onpointerdown',
    'onpointerup',
    'ontouchstart',
    'ontouchend',
    'onsubmit',
  ];
  for (const attr of handlerAttrs) {
    if ($el.attr(attr) !== undefined) $el.removeAttr(attr);
  }
  // SPA-routing data attributes used by Vue/React/Next/Nuxt routers.
  const routerAttrs = [
    'data-router-link',
    'data-link-to',
    'data-route',
    'data-navigation',
  ];
  for (const attr of routerAttrs) {
    if ($el.attr(attr) !== undefined) $el.removeAttr(attr);
  }
}

/**
 * Builds a slug-safe file name for a stepId.
 */
export function stepIdToFilename(stepId: string): string {
  if (!stepId || stepId === 'main') return 'index.html';
  const safe = stepId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `${safe}.html`;
}
