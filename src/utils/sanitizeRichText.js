const sanitizeHtml = require('sanitize-html');

// Allowlist matching exactly what RichTextEditor's toolbar can produce:
// Bold, Italic, Underline, bullet/numbered lists. Anything else (scripts,
// event handlers, iframes, arbitrary attributes, etc.) is stripped rather
// than escaped, so the remaining text still reads naturally.
const RICH_TEXT_OPTIONS = {
  allowedTags: ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div'],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

/**
 * Sanitize a rich-text HTML field (description, project_background, etc.)
 * down to a safe allowlist of tags. Returns null/undefined unchanged so
 * "clear this field" still works, and leaves plain (non-HTML) strings as-is.
 */
const sanitizeRichText = (value) => {
  if (value == null || value === '') return value;
  return sanitizeHtml(String(value), RICH_TEXT_OPTIONS);
};

module.exports = { sanitizeRichText };
