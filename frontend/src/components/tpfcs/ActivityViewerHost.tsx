import { createPortal } from 'react-dom';
import { Link, useLocation, useSearchParams } from 'react-router';
import ActivityDetailView from '../../pages/Activities/ActivityDetailView';
import { useModalBehavior } from './Modal';
import { useActivityViewer, baseUrl, VIEWER_PARAM, VIEWER_SITE_PARAM } from '../../hooks/useActivityViewer';

/**
 * Mounted once in the app layout. Shows the activity viewer modal whenever the URL has ?activity=ID,
 * on whatever page the user is on (Gantt, project tab, activity list…).
 */
export default function ActivityViewerHost() {
  const [params] = useSearchParams();
  const id = Number(params.get(VIEWER_PARAM));
  if (!id) return null;
  return <ViewerModal key={id} id={id} siteId={params.get(VIEWER_SITE_PARAM) ? Number(params.get(VIEWER_SITE_PARAM)) : null} />;
}

function ViewerModal({ id, siteId }: { id: number; siteId: number | null }) {
  const location = useLocation();
  const { open, close } = useActivityViewer();
  useModalBehavior(true, close);

  const base = baseUrl(location.pathname, location.search);
  const here = location.pathname + location.search;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-[2px]" onClick={close} />

      <div className="relative w-full max-w-6xl bg-gray-50 dark:bg-gray-950 sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full sm:h-auto sm:max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sm:rounded-t-2xl flex-shrink-0">
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Activity details</span>
          <div className="flex items-center gap-3">
            {/* replace: Back from the full page should return to the page under the modal, not reopen it */}
            <Link to={`/activities/${id}${siteId ? `?site_id=${siteId}` : ''}`} replace state={{ from: base }}
              className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600">
              Open full page
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </Link>
            <button onClick={close} aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          <ActivityDetailView
            activityId={id}
            mode="modal"
            siteId={siteId}
            returnTo={here}
            onDeleted={close}
            onOpenActivity={(sid) => open(sid, { replace: true })}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
