// Source scanning shared by check and extract: which files carry copy, and TypeScript-based
// discovery of catalogue references and of literals that have not moved yet.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { ROOT } from './lib.mjs';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ts = require('typescript');

export const SCAN_ROOTS = ['apps/web', 'packages/ui/src', 'packages/domain/src', 'packages/connectors/src', 'packages/mock-data/src', 'packages/messages/src', 'apps/desktop-electron/src', 'apps/desktop-tauri/src-tauri/src'];
const SKIP_DIRS = new Set(['node_modules', 'out', '.next', 'dist', 'release', 'target', 'test-results', 'playwright-report', 'staging', 'e2e', 'scripts']);
const SKIP_FILES = /(\.test\.tsx?|\.spec\.tsx?|\.d\.ts|keys\.generated\.ts|test-setup\.ts|\.config\.(ts|js|mjs))$/;

export function sourceFiles(roots = SCAN_ROOTS) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const st = statSync(path);
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(path);
      } else if (/\.(tsx?|rs)$/.test(entry) && !SKIP_FILES.test(entry)) out.push(path);
    }
  };
  for (const r of roots) walk(join(ROOT, r));
  return out;
}

/** Props whose string value a person sees or hears. */
export const COPY_PROPS = new Set(['aria-label', 'aria-description', 'aria-roledescription', 'aria-placeholder', 'aria-valuetext', 'alt', 'title', 'placeholder', 'label', 'hint', 'legend', 'summary', 'description', 'text', 'caption', 'lede', 'heading', 'message', 'emptyText', 'loadingText', 'errorText', 'tooltip', 'confirmText', 'cancelText', 'submitText', 'srLabel', 'name', 'content']);
/** Props whose string value is never copy even when it looks like a sentence. */
export const NON_COPY_PROPS = new Set(['className', 'id', 'href', 'src', 'to', 'type', 'name', 'key', 'variant', 'size', 'tone', 'kind', 'role', 'htmlFor', 'value', 'defaultValue', 'autoComplete', 'inputMode', 'rel', 'target', 'data-state', 'style', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'path', 'testid', 'data-testid', 'lang', 'dir', 'scope', 'accelerator', 'phase', 'screen', 'idPrefix', 'process', 'agency', 'family', 'stage', 'accent']);

const WORDS = /[A-Za-z]{2,}/;
const PUNCT_ONLY = /^[\s\p{P}\p{S}\d]*$/u;

/** True when a string is copy a person would read: it has letters and is not just punctuation. */
export function looksLikeCopy(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed || PUNCT_ONLY.test(trimmed)) return false;
  if (!WORDS.test(trimmed)) return false;
  // Identifiers, paths, keys, CSS classes, ids and units are not copy.
  if (/^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/i.test(trimmed) && !/\s/.test(trimmed) && !/^[A-Z][a-z]+$/.test(trimmed)) return false;
  if (/^(#|\/|https?:|mailto:|tel:|var\(|calc\(|url\()/.test(trimmed)) return false;
  if (/^\d+(px|em|rem|%|ms|s)$/.test(trimmed)) return false;
  return true;
}

function nameOf(attr) {
  return attr.name && attr.name.getText ? attr.name.getText() : '';
}

/** Parse a TS or TSX file and visit nodes with the file text handy. */
export function parseSource(path) {
  const text = readFileSync(path, 'utf8');
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return { text, sf: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind) };
}

/**
 * Catalogue references in a file: every string literal or no-substitution template that is a
 * catalogue key, plus template prefixes such as `domain.agency.${x}` recorded as "domain.agency.*".
 */
export function references(path, keys) {
  const found = new Set();
  const patterns = new Set();
  if (path.endsWith('.rs')) {
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(/"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)"/g)) if (keys.has(m[1])) found.add(m[1]);
    return { found, patterns };
  }
  const { sf } = parseSource(path);
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (keys.has(node.text)) found.add(node.text);
    } else if (ts.isTemplateExpression(node)) {
      const head = node.head.text;
      if (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*\.$/.test(head)) patterns.add(`${head}*`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { found, patterns };
}

/** Literals a person could read that still sit in source: JSX text, copy props, and label maps. */
export function literals(path) {
  const out = [];
  const rel = relative(ROOT, path);
  if (path.endsWith('.rs')) {
    const text = readFileSync(path, 'utf8');
    text.split('\n').forEach((line, i) => {
      // Comments, accelerators, identifiers and developer-facing panics are not copy.
      if (/^\s*\/\//.test(line) || /\.expect\(|panic!|include_str!/.test(line)) return;
      for (const m of line.matchAll(/"([^"\\]*)"/g)) {
        const s = m[1];
        if (looksLikeCopy(s) && /\s/.test(s)) out.push({ file: rel, line: i + 1, text: s, kind: 'rust' });
      }
    });
    return out;
  }
  const { sf } = parseSource(path);
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  // Label maps are scanned in the domain and connectors packages and in the app's own modules
  // (report models, routes, sections, the store). Mock data is data by definition: only files
  // outside scenarios/ and generator/ are scanned there, and only for label-like properties.
  const inMockData = /packages\/mock-data\//.test(rel);
  const inDomainish = /packages\/(domain|connectors)\//.test(rel) || /^apps\/web\//.test(rel) || (inMockData && !/\/(scenarios|generator)\//.test(rel));
  const copyProp = inMockData ? /^(label|short|displayName)$/ : /^(label|short|title|description|lede|looksFor|plainLanguage|summary|help|hint|reason|purpose|howReal|displayName|note|text|message|placeholder|caption|heading|xLabel|yLabel|audience|empty|verify|legend|tooltip|ariaLabel|srLabel|status)$/;
  const copyCall = /^(toast|announce|confirm|set[A-Z]\w*(Error|Message|Status|Hint|Notice))$/;
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      if (looksLikeCopy(node.text)) out.push({ file: rel, line: line(node), text: node.text.replace(/\s+/g, ' ').trim(), kind: 'jsx-text' });
    } else if (ts.isJsxAttribute(node)) {
      const name = nameOf(node);
      const init = node.initializer;
      if (init && (COPY_PROPS.has(name) || (!NON_COPY_PROPS.has(name) && !name.startsWith('data-') && !name.startsWith('on')))) {
        let value;
        if (ts.isStringLiteral(init)) value = init.text;
        else if (ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) value = init.expression.text;
        else if (ts.isJsxExpression(init) && init.expression && ts.isTemplateExpression(init.expression)) {
          const parts = [init.expression.head.text, ...init.expression.templateSpans.map((s) => s.literal.text)];
          if (parts.some((p) => looksLikeCopy(p))) value = parts.join('{}');
        }
        if (value !== undefined && looksLikeCopy(value) && !NON_COPY_PROPS.has(name)) out.push({ file: rel, line: line(node), text: value, kind: `prop:${name}` });
      }
    } else if (ts.isJsxExpression(node) && node.expression && ts.isParenthesizedExpression(node.parent) === false) {
      const e = node.expression;
      if ((ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && looksLikeCopy(e.text) && ts.isJsxElement(node.parent)) out.push({ file: rel, line: line(node), text: e.text, kind: 'jsx-expression' });
      if (ts.isTemplateExpression(e) && ts.isJsxElement(node.parent)) {
        const parts = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)];
        if (parts.some((p) => looksLikeCopy(p))) out.push({ file: rel, line: line(node), text: parts.join('{}'), kind: 'jsx-template' });
      }
    } else if (inDomainish && ts.isPropertyAssignment(node)) {
      // Label maps and definitions: `label: 'Police'`, `description: '...'`, `looksFor: '...'`.
      const name = node.name.getText(sf).replace(/['"]/g, '');
      const init = node.initializer;
      if (copyProp.test(name)) {
        if ((ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) && looksLikeCopy(init.text)) out.push({ file: rel, line: line(node), text: init.text, kind: `map:${name}` });
        if (ts.isTemplateExpression(init)) {
          const parts = [init.head.text, ...init.templateSpans.map((s) => s.literal.text)];
          if (parts.some((p) => looksLikeCopy(p))) out.push({ file: rel, line: line(node), text: parts.join('{}'), kind: `map:${name}` });
        }
      }
    } else if (inDomainish && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && copyCall.test(node.expression.text)) {
      for (const arg of node.arguments) {
        if ((ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && looksLikeCopy(arg.text)) out.push({ file: rel, line: line(node), text: arg.text, kind: `call:${node.expression.text}` });
        if (ts.isTemplateExpression(arg)) {
          const parts = [arg.head.text, ...arg.templateSpans.map((s) => s.literal.text)];
          if (parts.some((p) => looksLikeCopy(p))) out.push({ file: rel, line: line(node), text: parts.join('{}'), kind: `call:${node.expression.text}` });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
