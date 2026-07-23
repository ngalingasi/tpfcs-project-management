// Renders HTML produced by RichTextEditor (bold/italic/underline/lists only).
//
// Note: the app sets `font-weight: normal` globally on <body>. Since that's
// an author-origin rule, it beats the browser's own default bold styling for
// <b>/<strong> (which is only a lower-priority user-agent default) — so
// without an explicit override here, bold text would silently render as
// regular weight. Underline/italic aren't affected by that reset, but are
// covered too for safety.
export default function RichTextDisplay({ html, className = '' }: { html: string; className?: string }) {
  return (
    <div
      className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
