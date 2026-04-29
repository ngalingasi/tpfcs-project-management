import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { projectsApi, objectivesApi, budgetApi } from '../../api';
import type { Project, Objective, ProjectBudgetSummary } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';

export default function ProjectDetail() {
  const { id }          = useParams<{ id: string }>();
  const [project,        setProject]       = useState<Project | null>(null);
  const [objectives,     setObjectives]    = useState<Objective[]>([]);
  const [budgetSummary,  setBudgetSummary] = useState<ProjectBudgetSummary | null>(null);
  const [loading,        setLoading]       = useState(true);

  useEffect(() => {
    if (!id) return;
    const pid = Number(id);
    Promise.all([
      projectsApi.get(pid),
      objectivesApi.listByProject(pid),
      budgetApi.projectSummary(pid).catch(() => null),
    ]).then(([pRes, oRes, bRes]) => {
      setProject(pRes.data);
      setObjectives(oRes.data);
      if (bRes) setBudgetSummary(bRes.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const fmt = (n?: number) => n != null ? `TZS ${Number(n).toLocaleString()}` : '—';

  if (loading) return (
    <div className="p-6 animate-pulse space-y-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );

  if (!project) return (
    <div className="p-6 text-center text-gray-400">Project not found</div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageBreadCrumb pageTitle={project.name} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{project.name}</h1>
          {project.project_reference && (
            <p className="text-sm text-gray-500 mt-0.5">Ref: {project.project_reference}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/projects/${id}/activities`}
            className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            View Activities
          </Link>
          <Link to={`/projects/${id}/edit`}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Edit
          </Link>
        </div>
      </div>

      {/* Budget Summary */}
      {budgetSummary && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Budget Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Total Budget',    value: fmt(budgetSummary.total_budget) },
              { label: 'Allocated',       value: fmt(budgetSummary.allocated_to_targets) },
              { label: 'Total Spent',     value: fmt(budgetSummary.total_spent) },
              { label: 'Remaining',       value: fmt(budgetSummary.remaining_budget) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
          <BudgetBar value={budgetSummary.spent_percentage} label="Spend Progress" />
        </div>
      )}

      {/* Project Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Sector',           value: project.sector_name },
          { label: 'Project Manager',  value: project.project_manager_name },
          { label: 'Start Date',       value: project.start_date ? new Date(project.start_date).toLocaleDateString() : undefined },
          { label: 'End Date',         value: project.end_date ? new Date(project.end_date).toLocaleDateString() : undefined },
          { label: 'Funding',          value: project.funding },
          { label: 'Cost Center',      value: project.cost_center },
          { label: 'Relevancy (FYDP)', value: project.relevancy_fypds },
          { label: 'Jobs Created',     value: project.job_created_no },
        ].map((item) => item.value ? (
          <div key={item.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">{item.value}</p>
          </div>
        ) : null)}
      </div>

      {/* Regions & Implementers */}
      {(project.regions?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Regions</h2>
          <div className="flex flex-wrap gap-2">
            {project.regions!.map((r) => (
              <span key={r.region_id} className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                {r.region_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Objectives */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Objectives</h2>
          <Link to={`/projects/${id}/objectives/new`}
            className="text-xs text-brand-500 hover:text-brand-600">+ Add Objective</Link>
        </div>
        {objectives.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No objectives yet</p>
        ) : (
          <div className="space-y-3">
            {objectives.map((o) => (
              <div key={o.objective_id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{o.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {o.target_count ?? 0} target{o.target_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <StatusBadge status={o.status} />
                  <Link to={`/objectives/${o.objective_id}`}
                    className="text-xs text-brand-500 hover:text-brand-600">View</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
