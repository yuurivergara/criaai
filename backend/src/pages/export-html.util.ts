import { load } from 'cheerio';

/**
 * Transforms a cloned step's HTML into a self-contained, static
 * snapshot suitable for downloading inside a ZIP and opening offline
 * via `file://`.
 *
 * The cloning pipeline injects a `<base href="https://origin/...">` so
 * the runtime iframe can resolve assets and lazy-loaded resources at
 * authoring time. That same `<base>`, however, becomes a footgun on
 * the exported ZIP: any leftover relative anchor or `window.location`
 * write will resolve against the *origin* and hard-redirect the user
 * out of the local copy. Single-page apps make this near-certain
 * because their hydration code typically checks `location.host` and
 * calls `router.replace(canonicalUrl)` when it doesn't match.
 *
 * Mitigations applied here, in order:
 *   1. Drop `<base href>` entirely. Asset URLs were already
 *      absolutized at clone time (see `absolutizeUrls`), so removing
 *      the base only changes the resolution rule for the few
 *      remaining relative anchors — which we want resolved against
 *      the local file, not the origin.
 *   2. Strip `<meta http-equiv="refresh">` and `<link rel="canonical|
 *      alternate">` tags that bootstrappers consume to "fix" the URL.
 *   3. Remove every `<script>` (inline and external). The ZIP is a
 *      static snapshot — none of the original SPA's runtime can do
 *      anything useful offline (no API, no router) and most of them
 *      will actively break navigation. The visual layout is preserved
 *      because layout/styling lives in CSS, not in scripts.
 *   4. Neutralize `<form action>` so any submit-style action falls
 *      back to a no-op instead of POSTing to the origin.
 *
 * The function returns the new HTML as a string. It never throws on
 * malformed input — the worst case is an unmodified passthrough.
 */
export function prepareExportHtml(html: string): string {
  if (!html) return html;
  const $ = load(html);

  if (!$('html').length) {
    return html;
  }

  $('head base').remove();
  $('head meta[http-equiv="refresh" i]').remove();
  $('head link[rel="canonical" i]').remove();
  $('head link[rel="alternate" i]').remove();
  $('head link[rel="dns-prefetch" i]').remove();
  $('head link[rel="preconnect" i]').remove();

  // SPAs hide their target URL in this kind of attribute as well —
  // strip it so a stray `<link rel="modulepreload">` doesn't trigger
  // a fetch of code that hard-redirects on import.
  $('head link[rel="modulepreload" i]').remove();
  $('head link[rel="prefetch" i]').remove();
  $('head link[rel="preload" i][as="script" i]').remove();

  // Static snapshot: drop every script. Keeping any of them risks the
  // hydration redirect described above. Tracking pixels were already
  // removed at clone time but we re-run a permissive sweep here to
  // cover anything injected post-clone (e.g. by user edits).
  $('script').remove();

  // Inline event handlers that contain `location` writes are another
  // common redirect path. Sweep them on every element.
  $('*').each((_, raw) => {
    const el = $(raw);
    const attrs = (raw as { attribs?: Record<string, string> }).attribs ?? {};
    for (const name of Object.keys(attrs)) {
      if (!name.startsWith('on')) continue;
      const value = attrs[name] ?? '';
      if (
        /\blocation\s*(?:\.\s*(?:href|assign|replace)\s*)?=/i.test(value) ||
        /\bwindow\s*\.\s*location\b/i.test(value)
      ) {
        el.removeAttr(name);
      }
    }
  });

  // Forms still pointing to the origin would POST out of the snapshot
  // on submit. We already neutralize them at clone time via
  // `rewriteNavigation({ neutralizeExternal: true })`, but harden the
  // exported copy too so a manual edit doesn't reintroduce a leak.
  $('form').each((_, raw) => {
    const el = $(raw);
    el.removeAttr('action');
    el.attr('onsubmit', 'return false;');
  });

  // Some SPAs ship a `<noscript>` block whose only purpose is to set
  // `<meta http-equiv=refresh>` in case JS is disabled. Catch that.
  $('noscript').each((_, raw) => {
    const el = $(raw);
    const inner = el.html() ?? '';
    if (/http-equiv\s*=\s*["']?refresh/i.test(inner)) {
      el.remove();
    }
  });

  // Re-add a tiny offline interaction shim so exported quizzes still work
  // without the original SPA runtime:
  //  - option cards toggle visual selected state (multi-select friendly)
  //  - "Continuar/Next" CTA unlocks after at least one selection
  //  - optional fallback navigation to the next qNN.html file when no
  //    rewritten href is available
  const shimCss = `
  [data-criaai-checked] {
    outline: 2px solid #f59e0b !important;
    outline-offset: 0 !important;
  }
  [data-criaai-checked].option-theme,
  [data-criaai-checked].option-background-default {
    border-color: #f59e0b !important;
  }
  [data-criaai-checked] .option-icon-value,
  [data-criaai-checked] .option-icon-select {
    background: #f59e0b !important;
    color: #fff !important;
    border-color: #f59e0b !important;
  }`;
  const shimJs = `
  (() => {
    const norm = (v) =>
      (v || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/\\s+/g, ' ')
        .trim();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.05;
    };
    const isAdvance = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const text = norm(el.textContent || (el instanceof HTMLInputElement ? el.value : ''));
      if (!text) return false;
      return /(continuar|continue|next|proximo|pr[óo]ximo|avancar|avanzar|enviar|prosseguir|start|comecar|comecar|submit)/.test(text);
    };
    const isOptionLike = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (!isVisible(el)) return false;
      if (isAdvance(el)) return false;
      const cls = ((el.className || '') + '').toLowerCase();
      if (cls.includes('option-theme') || cls.includes('option-background') || cls.includes('option-icon-value')) return true;
      if (el.matches('[role="checkbox"], [role="option"], [role="radio"], label')) return true;
      const txt = norm(el.textContent || '');
      return txt.length > 0 && txt.length < 180 && (el.tagName === 'BUTTON' || el.tagName === 'LABEL');
    };
    const markChecked = (node, checked) => {
      if (!(node instanceof HTMLElement)) return;
      if (checked) {
        node.setAttribute('data-criaai-checked', '1');
        node.classList.add('active');
        node.setAttribute('aria-checked', 'true');
      } else {
        node.removeAttribute('data-criaai-checked');
        node.classList.remove('active');
        node.setAttribute('aria-checked', 'false');
      }
      const icon = node.querySelector('.option-icon-value, .option-icon-select');
      if (icon && checked) icon.textContent = icon.textContent && icon.textContent.trim() ? icon.textContent : '✓';
      if (icon && !checked && icon.textContent && icon.textContent.trim() === '✓') icon.textContent = '';
    };
    const OPTION_SEL =
      'button, [role="button"], [role="checkbox"], [role="option"], [role="radio"], label, .option-icon-value';
    const getGroupHost = (option) => {
      let walk = option instanceof HTMLElement ? option : null;
      for (let i = 0; i < 10 && walk; i += 1) {
        walk = walk.parentElement;
        if (!walk) break;
        const peers = Array.from(walk.querySelectorAll(OPTION_SEL)).filter(
          (el) => el instanceof HTMLElement && isOptionLike(el),
        );
        if (peers.length >= 2 && peers.includes(option)) return walk;
      }
      return option.parentElement || document.body;
    };
    const inferSelectionMode = (option) => {
      if (!(option instanceof HTMLElement)) return 'single';
      const role = (option.getAttribute('role') || '').toLowerCase();
      if (role === 'checkbox') return 'multi';
      if (role === 'radio') return 'single';
      if (option.querySelector('input[type="checkbox"]')) return 'multi';
      if (option.querySelector('input[type="radio"]')) return 'single';
      // InLead hint: option-icon-value is used as checkbox-like marker.
      if (option.querySelector('.option-icon-value')) return 'multi';
      if (option.querySelector('.option-icon-select')) return 'single';
      // Text hint near the question.
      const scope = getGroupHost(option);
      const txt = norm((scope && scope.textContent) || '');
      if (
        /pode marcar varios|pode marcar vários|marque varios|marque varios|selecione mais de uma|select multiple|multi/.test(
          txt,
        )
      ) {
        return 'multi';
      }
      return 'single';
    };
    const ensureAdvanceEnabled = () => {
      const hasSelection =
        !!document.querySelector('[data-criaai-checked], input[type="checkbox"]:checked, input[type="radio"]:checked, [aria-checked="true"]') ||
        document.body.getAttribute('data-criaai-ruler-set') === '1';
      if (!hasSelection) return;
      const ctas = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'));
      for (const cta of ctas) {
        if (!(cta instanceof HTMLElement) || !isAdvance(cta)) continue;
        cta.removeAttribute('disabled');
        if (cta.getAttribute('aria-disabled') === 'true') cta.removeAttribute('aria-disabled');
        cta.classList.remove('cursor-not-allowed');
        cta.classList.add('cursor-pointer');
        let walk = cta.parentElement;
        for (let i = 0; i < 5 && walk; i += 1) {
          walk.classList.remove('opacity-75');
          walk.classList.add('opacity-100');
          walk = walk.parentElement;
        }
      }
    };
    const parseDisplay = (text) => {
      const m = (text || '').match(/(\\d{2,3})\\s*(kg|lb)?/i);
      if (!m) return null;
      return {
        value: Number.parseInt(m[1], 10),
        unit: (m[2] || 'kg').toLowerCase(),
      };
    };
    const refreshUnitToggleAndRuler = () => {
      const groups = Array.from(document.querySelectorAll('div,section,article')).slice(0, 1200);
      for (const g of groups) {
        if (!(g instanceof HTMLElement)) continue;
        const btns = Array.from(g.querySelectorAll('button')).filter((b) => b instanceof HTMLElement);
        if (btns.length < 2 || btns.length > 6) continue;
        const kgBtn = btns.find((b) => /^kg$/i.test((b.textContent || '').trim()));
        const lbBtn = btns.find((b) => /^lb$/i.test((b.textContent || '').trim()));
        if (!kgBtn || !lbBtn) continue;
        const display = g.querySelector('span[class*="text-4xl"], span[class*="text-3xl"], span') || g.parentElement?.querySelector('span[class*="text-4xl"]');
        if (!(display instanceof HTMLElement)) continue;
        const parsed = parseDisplay(display.textContent || '');
        if (!parsed) continue;
        const setUnit = (unit) => {
          kgBtn.classList.toggle('btn-theme', unit === 'kg');
          lbBtn.classList.toggle('btn-theme', unit === 'lb');
          const current = parseDisplay(display.textContent || '') || { value: parsed.value, unit: 'kg' };
          const currentKg = current.unit === 'lb' ? Math.max(35, Math.round(current.value / 2.20462)) : current.value;
          const nextValue = unit === 'lb' ? Math.round(currentKg * 2.20462) : currentKg;
          display.innerHTML = String(nextValue) + '<small class="text-xl">' + unit + '</small>';
        };
        kgBtn.addEventListener('click', (e) => {
          e.preventDefault();
          setUnit('kg');
        });
        lbBtn.addEventListener('click', (e) => {
          e.preventDefault();
          setUnit('lb');
        });
        const swiper = g.querySelector('.swiper');
        if (swiper instanceof HTMLElement) {
          let dragging = false;
          const resolveBounds = () => {
            const marks = Array.from(swiper.querySelectorAll('span'))
              .map((s) => Number.parseInt((s.textContent || '').trim(), 10))
              .filter((n) => Number.isFinite(n));
            if (marks.length >= 2) {
              return { min: Math.min(...marks), max: Math.max(...marks) };
            }
            return { min: 40, max: 220 };
          };
          const updateFromPointer = (clientX) => {
            const rect = swiper.getBoundingClientRect();
            const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0.5;
            const b = resolveBounds();
            const valueKg = Math.round(b.min + ratio * (b.max - b.min));
            const activeUnit = lbBtn.classList.contains('btn-theme') ? 'lb' : 'kg';
            const out = activeUnit === 'lb' ? Math.round(valueKg * 2.20462) : valueKg;
            display.innerHTML = String(out) + '<small class="text-xl">' + activeUnit + '</small>';
            document.body.setAttribute('data-criaai-ruler-set', '1');
            ensureAdvanceEnabled();
          };
          swiper.addEventListener('pointerdown', (e) => {
            dragging = true;
            updateFromPointer(e.clientX);
          });
          swiper.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            updateFromPointer(e.clientX);
          });
          window.addEventListener('pointerup', () => {
            dragging = false;
          });
          swiper.addEventListener('click', (e) => {
            updateFromPointer(e.clientX);
          });
        }
      }
    };
    const fallbackNextStep = () => {
      const p = window.location.pathname || '';
      const m = p.match(/(q)(\\d+)\\.html$/i);
      if (!m) return;
      const next = String(Number.parseInt(m[2], 10) + 1).padStart(m[2].length, '0');
      const href = p.replace(/q\\d+\\.html$/i, 'q' + next + '.html');
      window.location.href = href;
    };
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const checkoutNode = target.closest('[data-href], a[href]');
      if (checkoutNode instanceof HTMLElement) {
        const raw = (
          checkoutNode.getAttribute('data-href') ||
          checkoutNode.getAttribute('href') ||
          ''
        ).trim();
        if (/^https?:\\/\\//i.test(raw)) {
          event.preventDefault();
          window.location.href = raw;
          return;
        }
      }
      const option = target.closest(OPTION_SEL);
      if (option && isOptionLike(option)) {
        const mode = inferSelectionMode(option);
        const checked = option.hasAttribute('data-criaai-checked');
        if (mode === 'single') {
          const groupHost = getGroupHost(option);
          const peers = Array.from(groupHost.querySelectorAll(OPTION_SEL)).filter(
            (el) => el instanceof HTMLElement && isOptionLike(el),
          );
          for (const peer of peers) {
            if (peer === option) continue;
            markChecked(peer, false);
          }
          // Radio-like behavior: clicking again keeps it selected.
          markChecked(option, true);
        } else {
          markChecked(option, !checked);
        }
        ensureAdvanceEnabled();
        return;
      }
      const advance = target.closest('button, [role="button"], input[type="submit"], input[type="button"], a[href]');
      if (advance instanceof HTMLElement && isAdvance(advance)) {
        const anchor = advance.closest('a[href]');
        if (!anchor && !advance.getAttribute('data-criaai-nav') && !advance.getAttribute('data-criaai-wrap')) {
          event.preventDefault();
          fallbackNextStep();
        }
      }
    }, true);
    ensureAdvanceEnabled();
    refreshUnitToggleAndRuler();
  })();`;
  if ($('head').length) {
    $('head').append(`<style id="criaai-export-shim-style">${shimCss}</style>`);
  }
  if ($('body').length) {
    $('body').append(`<script id="criaai-export-shim">${shimJs}</script>`);
  }

  return $.html();
}
