import { load, type CheerioAPI, type Cheerio } from 'cheerio';
import type { Element as DomElement } from 'domhandler';

/**
 * Signals that the page relies on a custom JS drag/ruler (not a native
 * `<input type="range">`) that often breaks inside the editor iframe.
 */
export function detectLikelyCustomDragWidget(html: string): boolean {
  if (!html || html.length < 80) return false;
  const lower = html.toLowerCase();
  if (
    /arraste\s+para\s+ajustar|arraste\s+para\s+definir|drag\s+to\s+adjust/i.test(
      html,
    )
  ) {
    return true;
  }
  if (
    /qual\s+(é|eh|e)\s+sua\s+altura|what\s+(is|'s)\s+your\s+height/i.test(
      lower,
    ) &&
    /<script/i.test(html)
  ) {
    try {
      const $ = load(html);
      if (!$('input[type="range"]').length && $('script').length > 0) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Cheap deterministic replacement when the LLM is down: find the hint line
 * typical of drag rulers and swap a wrapping block for a plain text field.
 */
export function replaceDragRulerWithPlainInput(html: string): string | null {
  if (!html) return null;
  const $ = load(html);
  const body = $('body');
  if (!body.length) return null;

  let best: Cheerio<DomElement> | null = null;
  let bestLen = Infinity;

  body.find('*').each((_, raw) => {
    const node = $(raw);
    const txt = (node.text() || '').replace(/\s+/g, ' ').trim();
    if (!/arraste\s+para\s+ajustar|arraste\s+para\s+definir/i.test(txt)) return;
    if (txt.length >= bestLen || txt.length > 900) return;
    bestLen = txt.length;
    best = node;
  });

  if (best === null) return null;

  let node: Cheerio<DomElement> = best;
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = node.parent();
    if (!parent.length || parent.is('body')) break;
    const tlen = parent.text().replace(/\s+/g, ' ').trim().length;
    node = parent;
    if (tlen >= 140 && tlen < 8000) break;
  }

  /** Prefer CTAs outside our block; then data-criaai-nav from the clone preview. */
  const continueOnclick =
    "(function(){try{var q=/continuar|proximo|next|siguiente|avanzar|finalizar|resultado|gratis|trial/i;var n=document.querySelectorAll('button,a');for(var i=0;i<n.length;i++){var el=n[i];if(el.classList&&el.classList.contains('criaai-widget-continue-btn'))continue;var tx=(el.innerText||el.textContent||'').trim().toLowerCase();if(tx&&q.test(tx)&&el.offsetParent&&!el.closest('.criaai-widget-plain-wrap')){el.click();return}}var nav=document.querySelector('[data-criaai-nav],[data-criaai-wrap]');if(nav)nav.click()}catch(e){}})()";

  const replacement = `
<div class="criaai-widget-plain-wrap criaai-widget-plain" data-criaai-replaced="drag-widget">
  <label class="criaai-widget-label" for="criaai-simple-measure-input">Sua medida</label>
  <input id="criaai-simple-measure-input" type="text" inputmode="decimal" autocomplete="off" data-criaai-simple-input="" name="criaai_simple_measure" placeholder="Ex.: 180 cm" />
  <button type="button" class="criaai-widget-continue-btn" onclick="${continueOnclick}">Continuar</button>
</div>`;

  try {
    injectSimpleInputCssIfMissing($);
    node.replaceWith(replacement);
    return $.html();
  } catch {
    return null;
  }
}

export function injectSimpleInputCssIfMissing($: CheerioAPI): void {
  if ($('style#criaai-simple-widget-fallback').length) return;
  if (!$('head').length) return;
  $('head').append(`<style id="criaai-simple-widget-fallback">
    .criaai-widget-plain-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      width: 100%;
      max-width: 26rem;
      margin: 2rem auto;
      padding: 1.75rem 1.5rem 1.5rem;
      box-sizing: border-box;
      border-radius: 1.25rem;
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.95), rgba(255, 237, 213, 0.65));
      border: 1px solid rgba(251, 146, 60, 0.45);
      box-shadow: 0 12px 40px rgba(234, 88, 12, 0.12);
      font-family: inherit;
    }
    .criaai-widget-label {
      display: block;
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.02em;
      color: rgba(67, 56, 42, 0.92);
      margin: 0 0 0.65rem;
      width: 100%;
      max-width: 21rem;
      text-align: center;
    }
    .criaai-widget-plain-wrap input[data-criaai-simple-input] {
      width: 100%;
      max-width: 21rem;
      padding: 0.95rem 1.1rem;
      border-radius: 0.875rem;
      border: 2px solid rgba(251, 146, 60, 0.65);
      font-size: 1.25rem;
      font-weight: 600;
      box-sizing: border-box;
      background: #fff;
      color: #1c1917;
      text-align: center;
    }
    .criaai-widget-plain-wrap input[data-criaai-simple-input]::placeholder {
      color: rgba(120, 113, 108, 0.65);
      font-weight: 500;
    }
    .criaai-widget-plain-wrap input[data-criaai-simple-input]:focus {
      outline: none;
      border-color: #ea580c;
      box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.25);
    }
    .criaai-widget-continue-btn {
      margin-top: 1.15rem;
      width: 100%;
      max-width: 21rem;
      padding: 0.9rem 1.5rem;
      border-radius: 999px;
      border: none;
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 0.03em;
      cursor: pointer;
      background: linear-gradient(135deg, #fb923c 0%, #ea580c 55%, #c2410c 100%);
      color: #fff;
      box-shadow: 0 10px 28px rgba(234, 88, 12, 0.38);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .criaai-widget-continue-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 32px rgba(234, 88, 12, 0.45);
    }
    .criaai-widget-continue-btn:active {
      transform: translateY(0);
    }
  </style>`);
}
