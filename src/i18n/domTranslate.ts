// Arabic for the page bodies. The app shell is translated through t() in React; the tables, charts, KPI tiles and
// mock records are built from thousands of English literals in ~100 files, so instead of wrapping each one this
// module translates the rendered DOM: it looks every text node (and placeholder / title / aria-label) up in the
// Arabic dictionary and watches for changes, so pages that load data later or re-render are translated too.
// A string with no entry is left in English. Switching back to English restores the original text.
import { normalize, fill } from './normalize';

type Dict = Record<string, string>;

const ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE']);
const SEGMENTS = / — | · |: /;

let dict: Dict = {};
let observer: MutationObserver | null = null;
let queue = new Set<Node>();
let raf = 0;
const original = new Map<Node, string>(); // text node -> English text
const written = new Map<Node, string>(); // text node -> the Arabic we put there
const attrOriginal = new Map<Element, Partial<Record<(typeof ATTRS)[number], string>>>();

function lookup(text: string): string | undefined {
  const exact = dict[text];
  if (exact) return exact;
  const { key, values } = normalize(text);
  const hit = dict[key];
  if (hit) return fill(hit, values);
  return undefined;
}

/** Translates one trimmed string: whole string first, then each part of "A — B", "A · B" and "A: B". */
function translateText(trimmed: string): string | undefined {
  const whole = lookup(trimmed);
  if (whole) return whole;
  if (!SEGMENTS.test(trimmed)) return undefined;
  let any = false;
  const out = trimmed
    .split(/( — | · |: )/)
    .map((part) => {
      if (SEGMENTS.test(part) && part.length <= 3) return part;
      const t = lookup(part.trim());
      if (t) any = true;
      return t ?? part;
    })
    .join('');
  return any ? out : undefined;
}

function skip(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.hasAttribute('data-notranslate') || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

/** Attributes (placeholder, title, aria-label) can be translated on a textarea too; only its text content cannot. */
function skipAttrs(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.hasAttribute('data-notranslate')) return true;
  }
  return false;
}

function doText(node: Node) {
  const raw = node.nodeValue ?? '';
  if (written.get(node) === raw) return; // our own write
  const trimmed = raw.trim();
  if (!trimmed || !/[A-Za-z]/.test(trimmed) || skip(node.parentElement)) {
    original.delete(node);
    written.delete(node);
    return;
  }
  const ar = translateText(trimmed.replace(/\s+/g, ' '));
  original.set(node, raw);
  if (!ar) {
    written.delete(node);
    return;
  }
  const out = raw.replace(trimmed, ar);
  written.set(node, out);
  node.nodeValue = out;
}

function doElement(el: Element) {
  if (skipAttrs(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !/[A-Za-z]/.test(v)) continue;
    const saved = attrOriginal.get(el) ?? {};
    // an attribute we already translated keeps its English original until React changes it
    if (saved[a] !== undefined && dict[saved[a]!] === v) continue;
    const ar = translateText(v.trim());
    if (!ar) continue;
    saved[a] = v;
    attrOriginal.set(el, saved);
    el.setAttribute(a, ar);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName)) return;
  doElement(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) doText(n);
    else doElement(n as Element);
  }
}

function flush() {
  raf = 0;
  const batch = [...queue];
  queue = new Set();
  observer?.disconnect();
  for (const n of batch) if (n.isConnected) walk(n);
  observe();
}

function schedule(n: Node) {
  queue.add(n);
  if (!raf) raf = requestAnimationFrame(flush);
}

function observe() {
  observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

export function startDomTranslation(d: Dict) {
  dict = d;
  stopObserver();
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(schedule);
      else if (m.type === 'characterData') schedule(m.target);
      else if (m.target.nodeType === Node.ELEMENT_NODE) schedule(m.target);
    }
  });
  walk(document.body);
  observe();
}

function stopObserver() {
  observer?.disconnect();
  observer = null;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  queue = new Set();
}

/** Back to English: put every original text and attribute back. */
export function stopDomTranslation() {
  stopObserver();
  original.forEach((raw, node) => {
    if (node.isConnected && written.has(node) && node.nodeValue === written.get(node)) node.nodeValue = raw;
  });
  original.clear();
  written.clear();
  attrOriginal.forEach((saved, el) => {
    for (const a of ATTRS) if (saved[a] !== undefined && el.isConnected) el.setAttribute(a, saved[a]!);
  });
  attrOriginal.clear();
}
