// Allowlist matching exactly what RichTextEditor's toolbar can produce:
// Bold, Italic, Underline, bullet/numbered lists. Anything else (scripts,
// event handlers, iframes, arbitrary attributes, etc.) is stripped rather
// than escaped, so the remaining text still reads naturally.
//
// Deliberately dependency-free: the allowlist is tiny and fixed (our own
// editor only ever emits these tags, with no attributes, since paste is
// already reduced to plain text client-side), so a small regex pass covers
// it without pulling in a parser library — avoiding version-compatibility
// issues like sanitize-html's htmlparser2 dependency going ESM-only and
// breaking under CommonJS require() on some Node setups.
const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div']);

const stripDisallowed = (html) => {
  // Drop <script>/<style> tags together with their content entirely.
  let out = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Walk every remaining tag: keep it (stripped of any attributes) if it's
  // on the allowlist, otherwise drop the tag markup but keep any text
  // between tags untouched.
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g, (match, tagName, selfClose) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    const isClosing = match.startsWith('</');
    if (isClosing) return `</${tag}>`;
    return selfClose ? `<${tag}/>` : `<${tag}>`;
  });

  return out;
};

/**
 * Sanitize a rich-text HTML field (description, project_background, etc.)
 * down to a safe allowlist of tags. Returns null/undefined unchanged so
 * "clear this field" still works, and leaves plain (non-HTML) strings as-is.
 */
const sanitizeRichText = (value) => {
  if (value == null || value === '') return value;
  return stripDisallowed(String(value));
};

module.exports = { sanitizeRichText };
