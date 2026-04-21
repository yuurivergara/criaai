import { load } from 'cheerio';

export interface NavigationEdge {
  fromStepId: string;
  selector: string;
  toStepId: string;
  triggerText?: string;
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

  for (const edge of edges) {
    const target = $(edge.selector).first();
    if (!target.length) continue;
    const destination = resolver(edge.toStepId);
    if (!destination) continue;

    const tagName = (target.get(0) as { tagName?: string } | undefined)
      ?.tagName?.toLowerCase();

    target.attr('data-criaai-nav', edge.toStepId);

    if (tagName === 'a') {
      target.attr('href', destination);
      target.removeAttr('target');
      continue;
    }

    const parentAnchor = target.closest('a');
    if (parentAnchor.length) {
      parentAnchor.attr('href', destination);
      parentAnchor.removeAttr('target');
      continue;
    }

    const html = $.html(target);
    target.replaceWith(
      `<a href="${destination}" data-criaai-wrap="${edge.toStepId}" style="color:inherit;text-decoration:none;display:contents;">${html}</a>`,
    );
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
 * Builds a slug-safe file name for a stepId.
 */
export function stepIdToFilename(stepId: string): string {
  if (!stepId || stepId === 'main') return 'index.html';
  const safe = stepId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `${safe}.html`;
}
