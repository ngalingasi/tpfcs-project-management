import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router';
import ActivityDetailView from './ActivityDetailView';

/**
 * Full-page route /activities/:id. All content lives in ActivityDetailView so the same
 * component also renders inside the activity viewer modal.
 */
export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Where the user came from (project tab, plan, parent activity, list…). Back and delete return there.
  const backTo = (location.state as { from?: string } | null)?.from ?? '/activities';
  const here = location.pathname + location.search;
  const siteId = searchParams.get('site_id') ? Number(searchParams.get('site_id')) : null;

  return (
    <ActivityDetailView
      key={id}
      activityId={Number(id)}
      mode="page"
      siteId={siteId}
      backTo={backTo}
      returnTo={backTo}
      onDeleted={() => navigate(backTo, { replace: true })}
      onOpenActivity={(sid) => navigate(`/activities/${sid}`, { state: { from: here } })}
    />
  );
}
