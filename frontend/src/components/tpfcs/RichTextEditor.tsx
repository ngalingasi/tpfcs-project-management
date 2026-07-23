import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  value: string;              // HTML string
  onChange: (html: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

type Command = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

// A minimal, dependency-free rich text editor: a contentEditable box with a
// small toolbar (Bold / Italic / Underline / Bullet list / Numbered list).
// Pasted content is stripped down to plain text so formatting can only come
// from the toolbar — keeps the stored HTML small and safe.
export default function RichTextEditor({
  label, value, onChange, placeholder, required, error, className = '',
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<Command, boolean>>({
    bold: false, italic: false, underline: false, insertUnorderedList: false, insertOrderedList: false,
  });
  const [focused, setFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Only sync external value -> DOM when the editor isn't focused, so we
  // never clobber the user's cursor position while they're typing.
  useEffect(() => {
    if (!editorRef.current || focused) return;
    editorRef.current.innerHTML = value || '';
    setIsEmpty(!value || value === '<br>');
  }, [value, focused]);

  const refreshActiveState = () => {
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
  };

  const exec = (cmd: Command) => {
    editorRef.current?.focus();
    document.execCommand(cmd);
    handleInput();
    refreshActiveState();
  };

  const handleInput = () => {
    const html = editorRef.current?.innerHTML ?? '';
    setIsEmpty(!editorRef.current?.textContent?.trim());
    onChange(html === '<br>' ? '' : html);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    handleInput();
  };

  const ToolbarButton = ({ cmd, title, children }: { cmd: Command; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection intact
      onClick={() => exec(cmd)}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors ${
        active[cmd]
          ? 'bg-brand-500 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className={`rounded-lg border overflow-hidden ${error ? 'border-red-400' : 'border-gray-300 dark:border-gray-700'}`}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <ToolbarButton cmd="bold" title="Bold (Ctrl+B)"><span className="font-bold">B</span></ToolbarButton>
          <ToolbarButton cmd="italic" title="Italic (Ctrl+I)"><span className="italic">I</span></ToolbarButton>
          <ToolbarButton cmd="underline" title="Underline (Ctrl+U)"><span className="underline">U</span></ToolbarButton>
          <span className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          <ToolbarButton cmd="insertUnorderedList" title="Bullet list">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </ToolbarButton>
          <ToolbarButton cmd="insertOrderedList" title="Numbered list">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M4 6h1v2M4 10h2l-2 2.5h2M4 16.5h1.5a.5.5 0 010 1H4M4 18h1.5a.5.5 0 010 1H4" />
            </svg>
          </ToolbarButton>
        </div>

        {/* Editable area */}
        <div className="relative bg-white dark:bg-gray-900">
          {isEmpty && placeholder && (
            <p className="absolute top-2.5 left-3 text-sm text-gray-400 pointer-events-none">{placeholder}</p>
          )}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onPaste={handlePaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyUp={refreshActiveState}
            onMouseUp={refreshActiveState}
            className="min-h-[100px] max-h-64 overflow-y-auto px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline"
            suppressContentEditableWarning
          />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
