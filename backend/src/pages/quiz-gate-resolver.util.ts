/**
 * Quiz "gate" resolver.
 *
 * A quiz step becomes a "gate" when its Continue/Advance button stays
 * `disabled` until the user fills a text input, picks a date, selects a
 * dropdown option, or ticks a consent checkbox. The walker used to stall on
 * those steps because it only knew how to click.
 *
 * This util runs in the BROWSER (via `page.evaluate`) and fills every
 * unfilled gating field using a deterministic attribute-based heuristic —
 * no LLM calls in the hot path. It returns a structured report that the
 * Node side uses to:
 *   1. Decide whether we need an LLM fallback for residual fields.
 *   2. Wait until the advance button turns from disabled → enabled.
 *
 * Filling React/Vue-controlled inputs requires going through the native
 * value setter on the element prototype (otherwise the framework ignores
 * the change). The helper below does that correctly.
 */

export interface GateField {
  /** CSS selector usable to re-find the field later. */
  selector: string;
  /** HTML tag: input | select | textarea. */
  tag: string;
  /** `type` attribute when tag === input, otherwise ''. */
  type: string;
  /** `name` / `id` / `data-testid` — first non-empty wins. */
  idLabel: string;
  /** Visible label/question nearby (heading, placeholder, <p>, <label>). */
  questionText: string;
  /** Value the heuristic decided to fill (empty when no rule matched). */
  filledValue: string;
  /** True when the heuristic filled it; false when it still needs an answer. */
  resolved: boolean;
  /** Matched rule name (for diagnostics), e.g. "height-cm", "email", "generic-number". */
  ruleId: string;
}

export interface GateResolverReport {
  /** All gates we looked at (filled + unresolved). */
  fields: GateField[];
  /** Sub-set of `fields` that our heuristic could NOT resolve. */
  unresolved: GateField[];
  /**
   * Whether any advance/submit button on the step is currently disabled.
   * Useful for deciding whether to re-run the resolver after LLM suggestions.
   */
  advanceStillDisabled: boolean;
  /** Hash-ish id computed from question text + field names; used as LLM cache key. */
  gateSignature: string;
}

/**
 * Apply LLM-suggested values to the page. Takes an array of {selector,value}
 * and fills them using the same React-safe setter.
 */
export interface GateLlmSuggestion {
  selector: string;
  value: string;
}

/**
 * The browser-side resolver. Stringified so it can travel through
 * `page.evaluate(...)` without being transpiled.
 *
 * Exposes (on window.__criaaiGateResolver) two functions:
 *   - `run()`              → returns GateResolverReport
 *   - `applyLlm(fields)`   → applies [{selector,value}] and returns number of applied
 *
 * All logic is self-contained (no imports) so it runs in any page context.
 */
export const QUIZ_GATE_RESOLVER_BROWSER_JS = String.raw`
(function installCriaaiGateResolver() {
  if (window.__criaaiGateResolver) return;

  function safeLower(str) {
    try { return (str == null ? '' : String(str)).toLowerCase(); } catch (_) { return ''; }
  }
  function asciiFold(str) {
    try {
      return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (_) { return safeLower(str); }
  }
  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity || '1') < 0.05) return false;
    return true;
  }
  function isEffectivelyDisabled(el) {
    if (!el) return true;
    if (el.disabled) return true;
    const aria = el.getAttribute && el.getAttribute('aria-disabled');
    if (aria === 'true') return true;
    return false;
  }
  function cssPath(el, maxDepth) {
    if (!el || !(el instanceof Element)) return '';
    maxDepth = maxDepth || 5;
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < maxDepth) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) { part += '#' + CSS.escape(cur.id); parts.unshift(part); break; }
      const dt = cur.getAttribute && cur.getAttribute('data-testid');
      if (dt) { part += '[data-testid="' + dt.replace(/"/g, '\\"') + '"]'; parts.unshift(part); break; }
      const name = cur.getAttribute && cur.getAttribute('name');
      if (name) { part += '[name="' + name.replace(/"/g, '\\"') + '"]'; parts.unshift(part); break; }
      if (cur.classList && cur.classList.length) {
        part += '.' + Array.from(cur.classList).slice(0, 2).map(c => CSS.escape(c)).join('.');
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
      }
      parts.unshift(part);
      cur = cur.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  }
  function readNearbyLabel(el) {
    // 1) Explicit <label for=id>.
    try {
      const id = el.getAttribute('id');
      if (id) {
        const lbl = document.querySelector('label[for="' + CSS.escape(id) + '"]');
        if (lbl && lbl.textContent) return lbl.textContent.trim();
      }
    } catch (_) {}
    // 2) Wrapping <label>.
    try {
      const wrap = el.closest('label');
      if (wrap && wrap.textContent) return wrap.textContent.trim();
    } catch (_) {}
    // 3) Closest heading h1..h6 in ancestors.
    try {
      let cur = el.parentElement;
      for (let i = 0; i < 6 && cur; i += 1) {
        const h = cur.querySelector('h1, h2, h3, h4, h5, h6, [data-testid="header"]');
        if (h && h.textContent) return h.textContent.trim();
        cur = cur.parentElement;
      }
    } catch (_) {}
    // 4) Closest <p> sibling.
    try {
      const prev = el.previousElementSibling;
      if (prev && /^p|span|div$/i.test(prev.tagName) && prev.textContent) return prev.textContent.trim();
    } catch (_) {}
    return '';
  }
  function questionContext(el) {
    // Pull page heading (h1/h2/h3) + the nearest label + placeholder.
    const parts = [];
    const nearby = readNearbyLabel(el);
    if (nearby) parts.push(nearby);
    const ph = el.getAttribute && el.getAttribute('placeholder');
    if (ph) parts.push(ph);
    // Heading right at the top of the step container.
    try {
      const container = el.closest('form, section, [class*="quiz"], [class*="step"], [class*="container"]');
      if (container) {
        const h = container.querySelector('h1, h2, h3, [data-testid="header"]');
        if (h && h.textContent) parts.push(h.textContent.trim());
      }
    } catch (_) {}
    return parts.join(' | ').slice(0, 400);
  }

  function reactSetValue(el, value) {
    try {
      const proto =
        el.tagName === 'SELECT'   ? window.HTMLSelectElement.prototype   :
        el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype :
                                    window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value');
      if (setter && setter.set) setter.set.call(el, value);
      else el.value = value;
    } catch (_) {
      try { el.value = value; } catch (_) {}
    }
    try { el.dispatchEvent(new Event('input',  { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new Event('blur',   { bubbles: true })); } catch (_) {}
  }

  // Build a signal string from everything an attribute-based rule could use.
  function signalOf(el) {
    const pieces = [
      el.getAttribute('name'),
      el.getAttribute('id'),
      el.getAttribute('data-testid'),
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('inputmode'),
      el.getAttribute('pattern'),
      readNearbyLabel(el),
    ].filter(Boolean).map(asciiFold).join(' | ');
    return pieces;
  }

  function isUnitInches(signal, el) {
    if (/\b(in|inch|pulgada|pulgadas)\b/.test(signal)) return true;
    try {
      // When a cm/in toggle is present, inspect which side is "active".
      const toggle = el.closest('form, div, section') &&
        el.closest('form, div, section').querySelector('[data-testid="button-switch-left"], [data-testid="button-switch-right"]');
      if (toggle) {
        // Active button typically has different class or aria-pressed.
        const pressed = document.querySelector('[aria-pressed="true"]');
        if (pressed && /\bin\b|inch|pulg/.test(asciiFold(pressed.textContent || ''))) return true;
      }
    } catch (_) {}
    return false;
  }
  function isUnitPounds(signal) {
    return /\b(lb|lbs|pound|libra|libras)\b/.test(signal);
  }

  // Heuristic rules; each returns { value, ruleId } when it matches, else null.
  function resolveInput(el) {
    const type = safeLower(el.getAttribute('type') || 'text');
    const signal = signalOf(el);
    const inputmode = safeLower(el.getAttribute('inputmode') || '');
    const maxlen = parseInt(el.getAttribute('maxlength') || '0', 10);
    const min = parseFloat(el.getAttribute('min') || 'NaN');
    const max = parseFloat(el.getAttribute('max') || 'NaN');

    // Hard type-based shortcuts.
    if (type === 'email')                                return { value: 'teste@criaai.local',   ruleId: 'email' };
    if (type === 'tel')                                  return { value: '+5511999999999',       ruleId: 'phone' };
    if (type === 'date')                                 return { value: '2000-01-01',           ruleId: 'date' };
    if (type === 'url')                                  return { value: 'https://criaai.local', ruleId: 'url' };
    if (type === 'color')                                return { value: '#222222',              ruleId: 'color' };
    if (type === 'password')                             return { value: 'Criaai!2025',          ruleId: 'password' };
    if (type === 'range') {
      const mid = (!isNaN(min) && !isNaN(max)) ? (min + max) / 2 : 50;
      return { value: String(Math.round(mid)), ruleId: 'range' };
    }

    const looksNumeric =
      type === 'number' || inputmode === 'numeric' || inputmode === 'decimal' ||
      /^\[0-9\]|\\d/.test(el.getAttribute('pattern') || '');

    if (looksNumeric) {
      if (/\baltura|height|estatura|mides|mide|tama[nñ]o\b/.test(signal) || /\bcm\b|\bin\b/.test(signal)) {
        return isUnitInches(signal, el)
          ? { value: '67',  ruleId: 'height-in' }
          : { value: '170', ruleId: 'height-cm' };
      }
      if (/\bpeso|weight|kg|lb|libra|pound\b/.test(signal)) {
        return isUnitPounds(signal)
          ? { value: '154', ruleId: 'weight-lb' }
          : { value: '70',  ruleId: 'weight-kg' };
      }
      if (/\b(idade|edad|age|anos|a[nñ]os|years?)\b/.test(signal)) {
        return { value: '30', ruleId: 'age' };
      }
      if (/\b(cep|zip|postal)\b/.test(signal)) {
        return { value: '01000000', ruleId: 'zip' };
      }
      if (/\b(cpf|dni|tax|ssn)\b/.test(signal)) {
        return { value: '00000000000', ruleId: 'tax-id' };
      }
      // Generic numeric — respect min/max/maxlength.
      let guess = 1;
      if (!isNaN(min) && !isNaN(max)) guess = Math.round((min + max) / 2);
      else if (!isNaN(min))           guess = Math.max(1, Math.round(min));
      else if (!isNaN(max))           guess = Math.max(1, Math.round(max / 2));
      else if (maxlen && maxlen <= 3) guess = 25;      // short = probably age/height
      else if (maxlen && maxlen <= 4) guess = 170;     // 4 chars = height in cm typically
      return { value: String(guess), ruleId: 'generic-number' };
    }

    // Text-like.
    if (/\b(email|e-mail|correo)\b/.test(signal))                return { value: 'teste@criaai.local',   ruleId: 'email-text' };
    if (/\b(phone|tel|whats|telefone|telef|celular|m[oó]vil)\b/.test(signal))
                                                                 return { value: '+5511999999999',       ruleId: 'phone-text' };
    if (/\b(nome|name|nombre|first|last|surname|apellido)\b/.test(signal))
                                                                 return { value: 'Maria Silva',          ruleId: 'name' };
    if (/\b(cep|zip|postal|codigo postal)\b/.test(signal))       return { value: '01000000',             ruleId: 'zip-text' };
    if (/\b(cidade|city|ciudad)\b/.test(signal))                 return { value: 'São Paulo',            ruleId: 'city' };
    if (/\b(cupom|coupon|discount|promo)\b/.test(signal))        return { value: '',                     ruleId: 'coupon-skip' };

    // Fallback — "something reasonable".
    return { value: 'Criaai', ruleId: 'text-default' };
  }

  function resolveSelect(sel) {
    const opts = Array.from(sel.querySelectorAll('option'));
    // Avoid placeholder-ish first option ("selecione...", "--", "") unless it's the only one.
    const looksPlaceholder = (o) => {
      const v = (o.value || '').trim();
      const t = asciiFold(o.textContent || '').trim();
      if (!v) return true;
      if (/^(selecione|seleccione|select|choose|--|---)$/.test(t)) return true;
      return false;
    };
    const target = opts.find(o => !looksPlaceholder(o)) || opts.find(o => o.value) || opts[1] || opts[0];
    if (!target) return { value: '', ruleId: 'select-empty' };
    return { value: target.value, ruleId: 'select-first' };
  }

  function gateSignatureOf(fields) {
    // Short 32-bit FNV-1a digest of (name|id|placeholder + question text).
    const seed = fields.map(f => (f.idLabel + '::' + f.questionText)).join('§');
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return 'g' + h.toString(16);
  }

  function anyAdvanceDisabled() {
    // Any submit-like button in the visible area that is currently disabled.
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    let found = false;
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const text = asciiFold(b.textContent || '').trim();
      const dt   = asciiFold(b.getAttribute && b.getAttribute('data-testid') || '');
      const looksAdvance =
        b.getAttribute('type') === 'submit' ||
        /\b(continuar|continue|next|siguiente|avancar|avanzar|submit|enviar|empezar|comecar|start|ok)\b/.test(text) ||
        /continue|submit|advance|next|start/.test(dt);
      if (!looksAdvance) continue;
      if (isEffectivelyDisabled(b)) { found = true; break; }
    }
    return found;
  }

  function run() {
    const report = { fields: [], unresolved: [], advanceStillDisabled: false, gateSignature: '' };

    // Collect gating candidates in the currently-visible form(s).
    const nodes = Array.from(document.querySelectorAll(
      'input, select, textarea'
    )).filter(isVisible);

    for (const el of nodes) {
      const tag = el.tagName.toLowerCase();
      const type = safeLower(el.getAttribute('type') || 'text');

      // Skip radio/checkbox/hidden/button inputs — other autofill paths handle
      // those (autoFillSelections + preSelectClickableOption).
      if (tag === 'input' && (
        type === 'radio' || type === 'checkbox' ||
        type === 'hidden' || type === 'submit' ||
        type === 'button' || type === 'reset' ||
        type === 'file' || type === 'image'
      )) continue;

      if (isEffectivelyDisabled(el)) continue;
      if (el.readOnly) continue;

      const currentValue = (el.value == null ? '' : String(el.value)).trim();
      if (currentValue) continue; // already filled by user / autocompleted

      const idLabel = (el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('data-testid') || '').slice(0, 120);
      const questionText = questionContext(el);
      const selector = cssPath(el);

      let decision = null;
      if (tag === 'select')        decision = resolveSelect(el);
      else                         decision = resolveInput(el); // input + textarea share rules

      const field = {
        selector,
        tag,
        type,
        idLabel,
        questionText,
        filledValue: decision ? decision.value : '',
        resolved: false,
        ruleId: decision ? decision.ruleId : 'none',
      };

      if (decision && decision.value !== '') {
        try {
          reactSetValue(el, decision.value);
          field.resolved = true;
        } catch (_) { field.resolved = false; }
      }

      report.fields.push(field);
      if (!field.resolved) report.unresolved.push(field);
    }

    report.advanceStillDisabled = anyAdvanceDisabled();
    report.gateSignature = gateSignatureOf(report.fields);
    return report;
  }

  function applyLlm(fields) {
    if (!Array.isArray(fields)) return 0;
    let applied = 0;
    for (const item of fields) {
      if (!item || !item.selector || item.value == null) continue;
      let el = null;
      try { el = document.querySelector(item.selector); } catch (_) {}
      if (!el) continue;
      try {
        reactSetValue(el, String(item.value));
        applied += 1;
      } catch (_) {}
    }
    return applied;
  }

  window.__criaaiGateResolver = { run: run, applyLlm: applyLlm };
})();
`;

export interface GateResolverResult {
  report: GateResolverReport;
  filledCount: number;
  unresolvedCount: number;
}
