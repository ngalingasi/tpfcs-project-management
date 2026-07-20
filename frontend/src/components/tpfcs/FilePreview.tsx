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
// Renders a PDF using pdf.js instead of the browser's native PDF plugin. This
// avoids the common "PDF preview unavailable" failure that happens when a
// user's browser is set to always download PDFs rather than display them
// inline — that setting breaks native <object>/<embed> viewers silently (no
// console error), but doesn't affect our own canvas rendering.
//
// All pages are laid out in one continuously-scrollable column (so scrolling
// naturally moves you into the next page, like a normal document), each page
// is rendered lazily as it nears the viewport, and each canvas is rasterized
// once at a fixed high-resolution "headroom" — zooming afterwards only
// resizes the canvas via CSS, so it stays crisp instead of re-rendering (and
// never blurs) across the whole zoom range.
function PdfViewer({ url }: { url: string }) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const canvasEls   = useRef<(HTMLCanvasElement | null)[]>([]);
  const wrapperEls  = useRef<(HTMLDivElement | null)[]>([]);
  const renderedSet = useRef<Set<number>>(new Set());
  const docRef      = useRef<any>(null);

  const [status, setStatus]     = useState<'loading' | 'ready' | 'error'>('loading');
  const [pages, setPages]       = useState<{ width: number; height: number }[]>([]); // CSS size at zoom = 1
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom]         = useState(1.25); // 1 = "fit width"; defaults zoomed in slightly past fit

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const zoomIn    = () => setZoom(z => Math.min(ZOOM_MAX, Math.round((z + 0.25) * 100) / 100));
  const zoomOut   = () => setZoom(z => Math.max(ZOOM_MIN, Math.round((z - 0.25) * 100) / 100));
  const zoomReset = () => setZoom(1.25);

  // Load the document and compute each page's "fit width" CSS dimensions.
  // (Cheap — just reads each page's intrinsic size, doesn't rasterize yet.)
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPages([]);
    setCurrentPage(1);
    setZoom(1.25);
    renderedSet.current.clear();
    canvasEls.current = [];
    wrapperEls.current = [];

    pdfjsLib.getDocument({ url }).promise
      .then(async doc => {
        if (cancelled) return;
        docRef.current = doc;
        const containerWidth = Math.min((scrollRef.current?.clientWidth ?? 900) - 16, 1500);
        const dims: { width: number; height: number }[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          const fitScale = containerWidth / vp.width;
          dims.push({ width: containerWidth, height: vp.height * fitScale });
        }
        if (cancelled) return;
        setPages(dims);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; };
  }, [url]);

  // Rasterize one page at a fixed high-resolution headroom (runs once per page).
  const renderPage = async (idx: number) => {
    if (renderedSet.current.has(idx) || !docRef.current) return;
    const canvas = canvasEls.current[idx];
    const dim = pages[idx];
    if (!canvas || !dim) return;
    renderedSet.current.add(idx); // mark immediately to avoid duplicate concurrent renders

    const page = await docRef.current.getPage(idx + 1);
    const naturalWidth = page.getViewport({ scale: 1 }).width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const HEADROOM = 2; // backing store rendered ~2x-4x the CSS size, so zoom up to 3x stays crisp
    const renderScale = (dim.width / naturalWidth) * dpr * HEADROOM;
    const viewport = page.getViewport({ scale: renderScale });

    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport }).promise;
  };

  // Lazily render pages as they approach the viewport, and track which page
  // is currently in view (for the "Page X of Y" indicator).
  useEffect(() => {
    if (status !== 'ready' || pages.length === 0) return;
    const root = scrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = Number((entry.target as HTMLElement).dataset.idx);
        if (entry.isIntersecting) {
          renderPage(idx);
          if (entry.intersectionRatio > 0.5) setCurrentPage(idx + 1);
        }
      });
    }, { root, rootMargin: '800px 0px', threshold: [0, 0.5, 1] });

    wrapperEls.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [status, pages.length]);

  const goToPage = (n: number) => {
    wrapperEls.current[n - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    <div className="relative w-full h-full">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-gray-400">Loading PDF...</p>
        </div>
      )}

      {/* Continuous vertical scroll — scrolling naturally moves between pages */}
      <div ref={scrollRef} className="absolute inset-0 overflow-auto flex flex-col items-center gap-3 py-3">
        {pages.map((dim, idx) => (
          <div
            key={idx}
            data-idx={idx}
            ref={el => { wrapperEls.current[idx] = el; }}
            className="flex-shrink-0"
            style={{ width: dim.width * zoom, height: dim.height * zoom }}
          >
            <canvas
              ref={el => { canvasEls.current[idx] = el; }}
              className="rounded shadow-2xl bg-white block"
              style={{ width: dim.width * zoom, height: dim.height * zoom }}
            />
          </div>
        ))}
      </div>

      {/* Floating controls — top right */}
      {status === 'ready' && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm px-2.5 py-2 rounded-xl shadow-lg border border-gray-700 flex-wrap justify-end max-w-[calc(100%-1.5rem)]">
          {/* Page navigation */}
          {pages.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                title="Previous page"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-xs text-gray-300 whitespace-nowrap px-0.5">Page {currentPage} of {pages.length}</span>
              <button
                onClick={() => goToPage(Math.min(pages.length, currentPage + 1))}
                disabled={currentPage >= pages.length}
                title="Next page"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <span className="w-px h-5 bg-gray-700" />
            </div>
          )}
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              title="Zoom out"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM8 11h6" /></svg>
            </button>
            <button
              onClick={zoomReset}
              title="Reset zoom"
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 min-w-[3.5rem]"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              title="Zoom in"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 8v6M8 11h6" /></svg>
            </button>
          </div>
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
  onDelete?: () => Promise<void> | void;
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
  url, name, mimeType, description, comments, onAddComment, onDeleteComment, canDeleteComment, onDelete, onClose,
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
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
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
        <div className={`flex-1 min-h-0 flex items-center justify-center ${type === 'pdf' ? 'p-2 overflow-hidden' : 'p-6 overflow-auto'}`}>
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
          <div className="w-full sm:w-80 flex-shrink-0 bg-[#17181c] border-t sm:border-t-0 sm:border-l border-gray-700 shadow-[-4px_0_16px_rgba(0,0,0,0.3)] flex flex-col min-h-0 max-h-[45vh] sm:max-h-none">
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
