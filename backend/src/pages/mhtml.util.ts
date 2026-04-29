import { load } from 'cheerio';

export interface MhtmlPart {
  headers: Record<string, string>;
  location: string;
  contentType: string;
  body: Buffer;
}

export interface ParsedMhtml {
  rootLocation: string | null;
  parts: MhtmlPart[];
}

function parseHeaders(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const unfolded = block.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const name = line.substring(0, idx).trim().toLowerCase();
    const value = line.substring(idx + 1).trim();
    if (name) headers[name] = value;
  }
  return headers;
}

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/i);
  if (!match) return null;
  return match[1] ?? match[2] ?? null;
}

function decodeQuotedPrintable(input: string): Buffer {
  const cleaned = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch === '=' && i + 2 < cleaned.length) {
      const hex = cleaned.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(cleaned.charCodeAt(i) & 0xff);
  }
  return Buffer.from(bytes);
}

function decodePartBody(raw: string, encoding: string): Buffer {
  const enc = (encoding || '').toLowerCase();
  if (enc === 'base64') {
    return Buffer.from(raw.replace(/\s+/g, ''), 'base64');
  }
  if (enc === 'quoted-printable') {
    return decodeQuotedPrintable(raw);
  }
  return Buffer.from(raw, 'binary');
}

export function parseMhtml(mhtml: string): ParsedMhtml | null {
  const headerEndMatch = mhtml.match(/\r?\n\r?\n/);
  if (!headerEndMatch || headerEndMatch.index === undefined) return null;
  const headerBlock = mhtml.substring(0, headerEndMatch.index);
  const body = mhtml.substring(headerEndMatch.index + headerEndMatch[0].length);
  const topHeaders = parseHeaders(headerBlock);
  const contentType = topHeaders['content-type'] ?? '';
  const boundary = extractBoundary(contentType);
  if (!boundary) return null;
  const rootLocation = topHeaders['snapshot-content-location'] ?? null;
  const delim = `--${boundary}`;
  const segments = body.split(delim);
  const parts: MhtmlPart[] = [];
  for (const seg of segments.slice(1)) {
    if (seg.startsWith('--')) continue;
    let s = seg.replace(/^\r?\n/, '');
    s = s.replace(/\r?\n$/, '');
    const partHeaderEnd = s.match(/\r?\n\r?\n/);
    if (!partHeaderEnd || partHeaderEnd.index === undefined) continue;
    const ph = s.substring(0, partHeaderEnd.index);
    const pb = s.substring(partHeaderEnd.index + partHeaderEnd[0].length);
    const headers = parseHeaders(ph);
    const encoding = headers['content-transfer-encoding'] ?? '7bit';
    const location = headers['content-location'] ?? '';
    const ct = headers['content-type'] ?? 'application/octet-stream';
    parts.push({
      headers,
      location,
      contentType: ct,
      body: decodePartBody(pb, encoding),
    });
  }
  return { rootLocation, parts };
}

function toDataUri(part: MhtmlPart): string {
  const mime =
    part.contentType.split(';')[0].trim() || 'application/octet-stream';
  return `data:${mime};base64,${part.body.toString('base64')}`;
}

function buildResourceMap(parts: MhtmlPart[]): Map<string, MhtmlPart> {
  const map = new Map<string, MhtmlPart>();
  for (const part of parts) {
    if (part.location) {
      map.set(part.location, part);
      try {
        const normalized = new URL(part.location).toString();
        if (normalized !== part.location) map.set(normalized, part);
      } catch {
        /* keep raw */
      }
    }
  }
  return map;
}

function resolveMaybe(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function rewriteCssUrls(
  css: string,
  cssBaseUrl: string,
  map: Map<string, MhtmlPart>,
): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, q, raw) => {
    const trimmed = String(raw).trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('#')) {
      return `url(${q}${trimmed}${q})`;
    }
    const resolved = resolveMaybe(trimmed, cssBaseUrl);
    const part = map.get(resolved);
    if (part) {
      return `url("${toDataUri(part)}")`;
    }
    return `url("${resolved}")`;
  });
}

function rewriteSrcset(
  srcset: string,
  base: string,
  map: Map<string, MhtmlPart>,
): string {
  return srcset
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return '';
      const chunks = trimmed.split(/\s+/);
      const urlPart = chunks[0];
      const descriptor = chunks.slice(1).join(' ');
      if (!urlPart || urlPart.startsWith('data:')) return trimmed;
      const resolved = resolveMaybe(urlPart, base);
      const hit = map.get(resolved);
      const replacement = hit ? toDataUri(hit) : resolved;
      return descriptor ? `${replacement} ${descriptor}` : replacement;
    })
    .filter(Boolean)
    .join(', ');
}

function findRootHtmlPart(parsed: ParsedMhtml): MhtmlPart | null {
  const map = buildResourceMap(parsed.parts);
  if (parsed.rootLocation) {
    const hit = map.get(parsed.rootLocation);
    if (hit && hit.contentType.includes('text/html')) return hit;
  }
  return (
    parsed.parts.find((p) =>
      p.contentType.toLowerCase().includes('text/html'),
    ) ?? null
  );
}

export function mhtmlToSelfContainedHtml(mhtml: string): string | null {
  const parsed = parseMhtml(mhtml);
  if (!parsed) return null;
  const map = buildResourceMap(parsed.parts);
  const rootPart = findRootHtmlPart(parsed);
  if (!rootPart) return null;
  const htmlBase = rootPart.location || parsed.rootLocation || 'about:blank';
  const htmlText = rootPart.body.toString('utf8');
  const $ = load(htmlText);

  $('link[rel]').each((_, el) => {
    const $el = $(el);
    const rel = ($el.attr('rel') ?? '').toLowerCase();
    const href = $el.attr('href');
    if (!href) return;
    if (rel.includes('stylesheet')) {
      const absolute = resolveMaybe(href, htmlBase);
      const part = map.get(absolute);
      if (part && part.contentType.toLowerCase().includes('text/css')) {
        const css = part.body.toString('utf8');
        const rewritten = rewriteCssUrls(css, absolute, map);
        const media = $el.attr('media');
        const mediaAttr = media ? ` media="${media}"` : '';
        $el.replaceWith(
          `<style data-inlined-from="${absolute}"${mediaAttr}>${rewritten}</style>`,
        );
        return;
      }
      $el.attr('href', absolute);
      return;
    }
    if (
      rel.includes('preload') ||
      rel.includes('icon') ||
      rel.includes('shortcut') ||
      rel.includes('apple-touch-icon') ||
      rel.includes('manifest')
    ) {
      const absolute = resolveMaybe(href, htmlBase);
      const part = map.get(absolute);
      $el.attr('href', part ? toDataUri(part) : absolute);
    }
  });

  $('style').each((_, el) => {
    const $el = $(el);
    const css = $el.html();
    if (css == null) return;
    $el.text(rewriteCssUrls(css, htmlBase, map));
  });

  $('img, video, audio, source, iframe, track, embed, script').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    if (src && !src.startsWith('data:')) {
      const absolute = resolveMaybe(src, htmlBase);
      const part = map.get(absolute);
      $el.attr('src', part ? toDataUri(part) : absolute);
    }
    const srcset = $el.attr('srcset');
    if (srcset) {
      $el.attr('srcset', rewriteSrcset(srcset, htmlBase, map));
    }
    const poster = $el.attr('poster');
    if (poster && !poster.startsWith('data:')) {
      const absolute = resolveMaybe(poster, htmlBase);
      const part = map.get(absolute);
      $el.attr('poster', part ? toDataUri(part) : absolute);
    }
    const dataSrc = $el.attr('data-src');
    if (dataSrc && !dataSrc.startsWith('data:')) {
      const absolute = resolveMaybe(dataSrc, htmlBase);
      const part = map.get(absolute);
      if (part) {
        $el.attr('data-src', toDataUri(part));
      }
    }
  });

  $('[style]').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style');
    if (style) {
      $el.attr('style', rewriteCssUrls(style, htmlBase, map));
    }
  });

  if (!$('head base[href]').length) {
    $('head').prepend(`<base href="${htmlBase}">`);
  }

  return $.html();
}
