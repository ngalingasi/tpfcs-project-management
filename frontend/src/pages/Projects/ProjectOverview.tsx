import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import {
  projectsApi, objectivesApi, targetsApi, activitiesApi, budgetApi, sitesApi, lookupsApi,
} from '../../api';
import type {
  Project, Objective, Target, Activity, ProjectBudgetSummary, ProjectSite, Region,
} from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';
import SearchableSelect from '../../components/tpfcs/SearchableSelect';

// Chevron used on every expandable row
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function ProjectOverview() {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);

  const [project,    setProject]    = useState<Project | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [targets,    setTargets]    = useState<Target[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sites,      setSites]      = useState<ProjectSite[]>([]);
  const [regions,    setRegions]    = useState<Region[]>([]);
  const [budget,     setBudget]     = useState<ProjectBudgetSummary | null>(null);
  const [loading,    setLoading]    = useState(true);

  const [regionFilter, setRegionFilter] = useState('');
  const [nameFilter,   setNameFilter]   = useState('');

  const [expandedSite,    setExpandedSite]    = useState<number | null>(null);
  const [expandedTargets, setExpandedTargets] = useState<Set<number>>(new Set());

  const toggleSite = (siteId: number) => setExpandedSite(cur => (cur === siteId ? null : siteId));
  const toggleTarget = (targetId: number) => setExpandedTargets(cur => {
    const next = new Set(cur);
    if (next.has(targetId)) next.delete(targetId); else next.add(targetId);
    return next;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, oRes, sRes] = await Promise.all([
        projectsApi.get(pid),
        objectivesApi.listByProject(pid),
        sitesApi.listByProject(pid),
      ]);
      setProject(pRes.data);
      setObjectives(oRes.data);
      setSites(sRes.data);
      budgetApi.projectSummary(pid).then(r => setBudget(r.data)).catch(() => {});
      lookupsApi.regions().then(r => setRegions(r.data)).catch(() => {});

      const allTargets: Target[] = [];
      for (const obj of oRes.data) {
        const tRes = await targetsApi.listByObjective(obj.objective_id);
        allTargets.push(...tRes.data);
      }
      setTargets(allTargets);

      const aRes = await activitiesApi.list({ page: 1, limit: 100 });
      const targetIds = new Set(allTargets.map(t => t.target_id));
      setActivities(aRes.data.results.filter(a => targetIds.has(a.target_id)));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n?: number | string | null) => (n != null && n !== '') ? `TZS ${Number(n).toLocaleString()}` : '—';

  const filteredSites = sites.filter(s => {
    if (regionFilter && String(s.region_id ?? '') !== regionFilter) return false;
    if (nameFilter && !s.site_name.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
    return true;
  });

  const hasActiveFilter = !!regionFilter || !!nameFilter;

  // Cascade the site filter down through Objective -> Target -> Activity so the
  // summary cards reflect only what's reachable from the currently filtered sites.
  const filteredObjectiveIds = new Set(
    filteredSites.map(s => s.objective_id).filter((v): v is number => v != null)
  );
  const filteredObjectives = hasActiveFilter
    ? objectives.filter(o => filteredObjectiveIds.has(o.objective_id))
    : objectives;
  const filteredTargets = hasActiveFilter
    ? targets.filter(t => filteredObjectiveIds.has(t.objective_id))
    : targets;
  const filteredTargetIds = new Set(filteredTargets.map(t => t.target_id));
  const filteredActivities = hasActiveFilter
    ? activities.filter(a => filteredTargetIds.has(a.target_id))
    : activities;

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );

  if (!project) return <div className="p-6 text-center text-gray-400">Project not found</div>;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{project.name} — Overview</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-500 dark:text-gray-400">
            {project.project_reference && <span>Ref: {project.project_reference}</span>}
            {project.sector_name && <span>· {project.sector_name}</span>}
            {project.project_manager_name && <span>· <span className="font-bold">Project Manager</span>: {project.project_manager_name}</span>}
          </div>
        </div>
        <Link to={`/projects/${pid}`}
          className="flex-shrink-0 px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
          Back to Project
        </Link>
      </div>

      {/* Budget bar */}
      {budget && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3 text-sm">
            {[
              { label: 'Total Budget', value: fmt(budget.total_budget) },
              { label: 'Allocated',    value: fmt(budget.allocated_to_targets) },
              { label: 'Spent',        value: fmt(budget.total_spent) },
              { label: 'Remaining',    value: fmt(budget.remaining_budget) },
            ].map(i => (
              <div key={i.label}>
                <p className="text-xs text-gray-400 mb-0.5">{i.label}</p>
                <p className="font-semibold text-gray-800 dark:text-white">{i.value}</p>
              </div>
            ))}
          </div>
          <BudgetBar value={budget.spent_percentage} label="Budget Utilisation" />
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Sites',      value: filteredSites.length },
          { label: 'Objectives', value: filteredObjectives.length },
          { label: 'Targets',    value: filteredTargets.length },
          { label: 'Activities', value: filteredActivities.length },
        ].map(i => (
          <div key={i.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-center">
            <p className="text-lg font-bold text-gray-800 dark:text-white">{i.value}</p>
            <p className="text-xs text-gray-400">{i.label}</p>
          </div>
        ))}
      </div>
      {hasActiveFilter && (
        <p className="text-xs text-gray-400 -mt-3">Counts reflect the current site filter. <button type="button" onClick={() => { setRegionFilter(''); setNameFilter(''); }} className="text-brand-500 hover:text-brand-600 font-medium">Clear filters</button></p>
      )}

      {/* Sites drill-down */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-gray-400">Sites Overview</p>
            <span className="text-xs text-gray-400">
              Showing {filteredSites.length} of {sites.length} total sites
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchableSelect
              value={regionFilter}
              onChange={setRegionFilter}
              options={regions.map(r => ({ value: String(r.region_id), label: r.region_name }))}
              placeholder="Filter by region"
              allLabel="All regions"
              className="w-full sm:w-56"
            />
            <input
              type="text"
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
              placeholder="Search site name..."
              className="w-full sm:w-56 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20"
            />
          </div>
        </div>

        {sites.length === 0 ? (
          <div className="text-center py-16 text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            No sites have been added to this project yet.
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="text-center py-16 text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            No sites match the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSites.map(site => {
              const siteOpen = expandedSite === site.site_id;
              const objective = site.objective_id
                ? objectives.find(o => o.objective_id === site.objective_id)
                : undefined;
              const siteTargets = objective
                ? targets.filter(t => t.objective_id === objective.objective_id)
                : [];

              return (
                <div key={site.site_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                  {/* Site row */}
                  <button
                    onClick={() => toggleSite(site.site_id)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Chevron open={siteOpen} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{site.site_name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {[site.region_name, site.district, site.ward].filter(Boolean).join(' · ') || 'No location details'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 hidden sm:inline">{siteTargets.length} targets</span>
                      <StatusBadge status={site.status} />
                    </div>
                  </button>

                  {/* Expanded: Objective -> Targets -> Activities */}
                  {siteOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/20">
                      {!objective ? (
                        <p className="text-sm text-gray-400">No objective linked to this site.</p>
                      ) : (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-xs font-bold text-gray-400">Objective</span>
                            <StatusBadge status={objective.status} />
                          </div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{objective.title}</p>
                          {objective.description && (
                            <p className="text-xs text-gray-500 mt-1">{objective.description}</p>
                          )}

                          {/* Targets under this objective */}
                          <div className="mt-3 space-y-2">
                            {siteTargets.length === 0 ? (
                              <p className="text-xs text-gray-400">No targets under this objective yet.</p>
                            ) : siteTargets.map(t => {
                              const targetOpen = expandedTargets.has(t.target_id);
                              const targetActivities = activities.filter(a => a.target_id === t.target_id);
                              return (
                                <div key={t.target_id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                  <button
                                    onClick={() => toggleTarget(t.target_id)}
                                    className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Chevron open={targetOpen} />
                                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{t.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-xs text-gray-400 hidden sm:inline">{targetActivities.length} activities</span>
                                      <StatusBadge status={t.status} />
                                    </div>
                                  </button>

                                  {targetOpen && (
                                    <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/20">
                                      {targetActivities.length === 0 ? (
                                        <p className="text-xs text-gray-400">No activities under this target yet.</p>
                                      ) : targetActivities.map(a => (
                                        <Link
                                          key={a.activity_id}
                                          to={`/activities/${a.activity_id}`}
                                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                                        >
                                          <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{a.name}</p>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs text-gray-400">{a.progress}%</span>
                                            <StatusBadge status={a.status} />
                                          </div>
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
