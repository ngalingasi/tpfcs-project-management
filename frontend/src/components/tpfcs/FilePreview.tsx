import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Bundle the pdf.js worker as a proper asset via Vite instead of relying on a CDN.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Renders a PDF onto a <canvas> using pdf.js instead of the browser's native
// PDF plugin. This avoids the common "PDF preview unavailable" failure that
// happens when a user's browser is set to always download PDFs rather than
// display them inline — that setting breaks native <object>/<embed> viewers
// silently (no console error), but doesn't affect our own canvas rendering.
function PdfViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum]   = useState(1);
  const [status, setStatus]     = useState<'loading' | 'ready' | 'error'>('loading');
  const docRef = useRef<any>(null);

  // Load the document whenever the URL changes
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPageNum(1);
    pdfjsLib.getDocument({ url }).promise
      .then(doc => {
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [url]);

  // Render the current page onto the canvas
  useEffect(() => {
    if (status !== 'ready' || !docRef.current || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await docRef.current.getPage(pageNum);
      if (cancelled) return;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Fit to the available viewport width, capped for very wide screens
      const containerWidth = Math.min(canvas.parentElement?.clientWidth ?? 900, 1100);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [status, pageNum]);

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-gray-400">
        <svg className="w-12 h-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">Could not load this PDF</p>
        <a href={url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full">
      {status === 'loading' && <p className="text-sm text-gray-400">Loading PDF...</p>}
      <div className="flex-1 overflow-auto w-full flex justify-center">
        <canvas ref={canvasRef} className="rounded shadow-2xl bg-white max-w-full" />
      </div>
      {status === 'ready' && numPages > 1 && (
        <div className="flex items-center gap-4 flex-shrink-0 pb-1">
          <button
            onClick={() => setPageNum(p => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-gray-300">Page {pageNum} of {numPages}</span>
          <button
            onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

interface CommentItem {
  comment_id: number;
  comment: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}

interface Props {
  url: string;
  name: string;
  mimeType?: string;
  description?: string | null;
  comments?: CommentItem[];
  onAddComment?: (text: string) => Promise<void> | void;
  onDeleteComment?: (commentId: number) => Promise<void> | void;
  canDeleteComment?: (c: CommentItem) => boolean;
  onClose: () => void;
}

const getType = (mime?: string, name?: string): 'image' | 'pdf' | 'other' => {
  const m = (mime ?? '').toLowerCase();
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (m.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  return 'other';
};

export default function FilePreview({
  url, name, mimeType, description, comments, onAddComment, onDeleteComment, canDeleteComment, onClose,
}: Props) {
  const type = getType(mimeType, name);
  const [imgError, setImgError] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const showCommentPanel = !!onAddComment;

  const submitComment = async () => {
    if (!commentText.trim() || !onAddComment) return;
    setSending(true);
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-white truncate">{name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={url} download={name}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: media + optional caption/comments panel */}
      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        {/* Media */}
        <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-6">
          {type === 'image' && !imgError && (
            <img src={url} alt={name} onError={() => setImgError(true)}
              className="max-w-full max-h-full object-contain rounded shadow-2xl" />
          )}

          {type === 'pdf' && <PdfViewer url={url} />}

          {(type === 'other' || (type === 'image' && imgError)) && (
            <div className="flex flex-col items-center justify-center gap-4 text-gray-400">
              <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">Preview not available for this file type</p>
              <a href={url} download={name}
                className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">
                Download to view
              </a>
            </div>
          )}
        </div>

        {/* Caption + comments panel (WhatsApp-style) */}
        {(description || showCommentPanel) && (
          <div className="w-full sm:w-80 flex-shrink-0 bg-gray-900 border-t sm:border-t-0 sm:border-l border-gray-800 flex flex-col min-h-0 max-h-[45vh] sm:max-h-none">
            {description && (
              <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
                <p className="text-xs text-gray-500 mb-1">Caption</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{description}</p>
              </div>
            )}

            {showCommentPanel && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                  {(!comments || comments.length === 0) ? (
                    <p className="text-xs text-gray-500">No comments yet.</p>
                  ) : comments.map(c => (
                    <div key={c.comment_id} className="group">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-300">{c.created_by_name ?? 'Unknown'}</p>
                        {canDeleteComment?.(c) && onDeleteComment && (
                          <button
                            onClick={() => onDeleteComment(c.comment_id)}
                            className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >Delete</button>
                        )}
                      </div>
                      <p className="text-sm text-gray-200 bg-gray-800 rounded-lg px-3 py-2 mt-1 whitespace-pre-wrap">{c.comment}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(c.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-800 flex-shrink-0 flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !sending) submitComment(); }}
                    placeholder="Add a comment..."
                    className="flex-1 rounded-full bg-gray-800 border border-gray-700 px-3.5 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-400"
                  />
                  <button
                    onClick={submitComment}
                    disabled={sending || !commentText.trim()}
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9-7-9-7v14zM5 12h13" transform="rotate(90 12 12)" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
