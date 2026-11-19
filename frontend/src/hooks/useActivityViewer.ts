import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Query parameters that drive the activity viewer modal. */
export const VIEWER_PARAM = 'activity';
export const VIEWER_SITE_PARAM = 'activity_site';

/** The current URL without the viewer parameters, i.e. the page the modal sits on. */
export function baseUrl(pathname: string, search: string) {
  const sp = new URLSearchParams(search);
  sp.delete(VIEWER_PARAM);
  sp.delete(VIEWER_SITE_PARAM);
  const q = sp.toString();
  return pathname + (q ? `?${q}` : '');
}

/**
 * Open / close the activity viewer modal from any page.
 *
 * The modal is part of the URL (?activity=ID) so the browser Back button closes it, refresh keeps it
 * open and the link can be shared. Opening pushes a history entry; swapping to a sub-activity replaces it.
 */
export function useActivityViewer() {
  const navigate = useNavigate();
  const location = useLocation();

  const open = useCallback((id: number, opts?: { siteId?: number | null; replace?: boolean }) => {
    const sp = new URLSearchParams(location.search);
    sp.set(VIEWER_PARAM, String(id));
    if (opts?.siteId) sp.set(VIEWER_SITE_PARAM, String(opts.siteId)); else sp.delete(VIEWER_SITE_PARAM);
    navigate(
      { pathname: location.pathname, search: `?${sp.toString()}` },
      { replace: !!opts?.replace, state: { activityViewer: true } },
    );
  }, [navigate, location.pathname, location.search]);

  const close = useCallback(() => {
    // We pushed an entry when opening, so Back is the cleanest way to close. If the page was loaded
    // directly with ?activity=ID there is nothing to go back to, so just drop the parameters.
    if ((location.state as { activityViewer?: boolean } | null)?.activityViewer) {
      navigate(-1);
    } else {
      navigate(baseUrl(location.pathname, location.search), { replace: true });
    }
  }, [navigate, location.pathname, location.search, location.state]);

  return { open, close };
}
