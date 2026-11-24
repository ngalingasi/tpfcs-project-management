import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { projectsApi } from '../../api';
import { useAuth } from '../../store/authStore';
import GeoExplorer from '../../components/tpfcs/geo/GeoExplorer';

/** Full-page map of a project's points. */
export default function ProjectMap() {
  const { id } = useParams();
  const pid = Number(id);
  const { user } = useAuth();
  const [project, setProject] = useState<{ name: string; project_manager_id?: number | null } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsApi.get(pid).then((r) => setProject(r.data as unknown as { name: string; project_manager_id?: number | null }))
      .catch((e) => setError(e?.response?.data?.message ?? 'Project not found'));
  }, [pid]);

  const canManage = user?.role === 'admin' || (project?.project_manager_id != null && Number(project.project_manager_id) === Number(user?.user_id));

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[480px]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <Link to={`/projects/${pid}?tab=map`} className="text-xs text-brand-500 hover:underline">← Back to project</Link>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white truncate">{project?.name ?? 'Project'} · Map</h1>
        </div>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : (
        <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {project && <GeoExplorer projectId={pid} canManage={canManage} />}
        </div>
      )}
    </div>
  );
}
