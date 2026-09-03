/**
 * mas/no-hardcoded-copy: JSX text and copy-bearing props must come from the message catalogue.
 * Punctuation, symbols, digits and whitespace are allowed; anything with two or more letters is
 * reported unless it is a known non-copy value (an identifier, a path, a unit).
 */
const COPY_PROPS = new Set(['aria-label', 'aria-description', 'aria-roledescription', 'aria-placeholder', 'aria-valuetext', 'alt', 'title', 'placeholder', 'label', 'hint', 'legend', 'summary', 'description', 'text', 'caption', 'lede', 'heading', 'message', 'tooltip', 'srLabel']);
const PUNCT_ONLY = /^[\s\p{P}\p{S}\d]*$/u;

function looksLikeCopy(text, allowed) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed || PUNCT_ONLY.test(trimmed) || allowed.has(trimmed)) return false;
  if (!/[A-Za-z]{2,}/.test(trimmed)) return false;
  if (/^(#|\/|https?:|mailto:|tel:|var\(|calc\()/.test(trimmed)) return false;
  return true;
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'User-visible strings must come from the message catalogue (@mas/messages)' },
    schema: [{ type: 'object', properties: { allowedStrings: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
    messages: { copy: 'Hard-coded copy "{{text}}". Move it to packages/messages/src/en-GB.json and render it with t().' },
  },
  create(context) {
    const allowed = new Set((context.options[0] && context.options[0].allowedStrings) || []);
    const report = (node, text) => context.report({ node, messageId: 'copy', data: { text: text.replace(/\s+/g, ' ').trim().slice(0, 40) } });
    return {
      JSXText(node) {
        if (looksLikeCopy(node.value, allowed)) report(node, node.value);
      },
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (typeof name !== 'string' || !COPY_PROPS.has(name) || !node.value) return;
        if (node.value.type === 'Literal' && typeof node.value.value === 'string' && looksLikeCopy(node.value.value, allowed)) report(node.value, node.value.value);
        if (node.value.type === 'JSXExpressionContainer') {
          const e = node.value.expression;
          if (e.type === 'Literal' && typeof e.value === 'string' && looksLikeCopy(e.value, allowed)) report(e, e.value);
          if (e.type === 'TemplateLiteral' && e.quasis.some((q) => looksLikeCopy(q.value.raw, allowed))) report(e, e.quasis.map((q) => q.value.raw).join('{}'));
        }
      },
      JSXExpressionContainer(node) {
        if (!node.parent || (node.parent.type !== 'JSXElement' && node.parent.type !== 'JSXFragment')) return;
        const e = node.expression;
        if (e.type === 'Literal' && typeof e.value === 'string' && looksLikeCopy(e.value, allowed)) report(e, e.value);
        if (e.type === 'TemplateLiteral' && e.quasis.some((q) => looksLikeCopy(q.value.raw, allowed))) report(e, e.quasis.map((q) => q.value.raw).join('{}'));
      },
    };
  },
};
