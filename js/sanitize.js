// HTML sanitizer for untrusted markup — the single path through which
// markdown-derived HTML (identity descriptions, CMS banners) reaches the DOM.
// Allowlist-based: parse inert via DOMParser, drop every element/attribute
// not explicitly allowed, reject non-http(s)/mailto URLs.

import { marked } from 'marked';

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'pre', 'kbd',
  'p', 'br', 'hr', 'blockquote', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'span',
]);

// tag -> allowed attributes. URL-valued attributes are additionally
// protocol-checked. Everything else (on*, style, class, ...) is dropped.
const ALLOWED_ATTRS = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title'],
  ol: ['start'],
};

const URL_ATTRS = new Set(['href', 'src']);
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function safeUrlValue(value) {
  try {
    return SAFE_PROTOCOLS.has(new URL(value, location.href).protocol);
  } catch {
    return false;
  }
}

// True for absolute http(s) URLs only — for API-provided navigation targets
// (approval_url, paypal_manage_url) that must never be javascript: etc.
export function isSafeHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();                                   // comments, CDATA, ...
      continue;
    }
    const tag = child.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap unknown-but-benign containers so their text survives;
      // remove script-ish elements wholesale, content included.
      if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math',
           'template', 'link', 'meta', 'base', 'form', 'input', 'button',
           'textarea', 'select'].includes(tag)) {
        child.remove();
      } else {
        child.replaceWith(...child.childNodes);
      }
      continue;
    }
    const allowed = ALLOWED_ATTRS[tag] ?? [];
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase();
      if (!allowed.includes(name) || (URL_ATTRS.has(name) && !safeUrlValue(attr.value))) {
        child.removeAttribute(attr.name);
      }
    }
    if (tag === 'a') {
      // External-safe defaults; same-page anchors don't need either.
      child.setAttribute('rel', 'noopener noreferrer');
      child.setAttribute('target', '_blank');
    }
    sanitizeNode(child);
  }
}

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

// Untrusted markdown → safe HTML. The only way markdown may reach innerHTML.
export function renderMarkdown(md) {
  return sanitizeHtml(marked.parse(md || ''));
}
