import type { MouseEvent, ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useActivityViewer, baseUrl } from '../../hooks/useActivityViewer';

interface Props {
  id: number;
  siteId?: number | null;
  className?: string;
  title?: string;
  children: ReactNode;
}

/**
 * A real link to the full activity page that opens the quick-view modal on a normal click.
 * Ctrl/Cmd/Shift/middle-click keep the browser's native behaviour (open in a new tab/window).
 */
export default function ActivityLink({ id, siteId, className, title, children }: Props) {
  const { open } = useActivityViewer();
  const location = useLocation();
  const href = `/activities/${id}${siteId ? `?site_id=${siteId}` : ''}`;

  const onClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(id, { siteId });
  };

  return (
    <Link to={href} state={{ from: baseUrl(location.pathname, location.search) }}
      onClick={onClick} className={className} title={title}>
      {children}
    </Link>
  );
}
