import { useEffect, useState } from 'react';
import { activitiesApi, objectivesApi, targetsApi, projectsApi, usersApi } from '../../api';
import type { Activity, Project, Target, Objective } from '../../types';

interface AnalysisData {
  // Project health
  targets: Target[];
  activities: Activity[];
  projects: Project[];
  objectives: Objective[];
  users: any[];
  // Derived
  loaded: boolean;
}

export default function AnalysisDashboard() {
  const [data, setData] = useState<AnalysisData>({
    targets: [], activities: [], projects: [], objectives: [], users: [], loaded: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, pRes, uRes] = await Promise.all([
          activitiesApi.list({ limit: 1000 }),
          projectsApi.list({ limit: 100 }),
          usersApi.list({ limit: 100 }),
        ]);

        const activities = aRes.data.results;
        const projects   = pRes.data.results;
        const users      = uRes.data.results;

        // Load all targets from all objectives
        const allTargets: Target[] = [];
        const allObjectives: Objective[] = [];
        for (const p of projects) {
          const oRes = await objectivesApi.listByProject(p.project_id);
          allObjectives.push(...oRes.data);
          for (const o of oRes.data) {
            const tRes = await targetsApi.listByObjective(o.objective_id);
            allTargets.push(...tRes.data);
          }
        }

        setData({ targets: allTargets, activities, projects, objectives: allObjectives, users, loaded: true });
      } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
    </div>
  );

  const { activities, targets, objectives, users } = data;

  // ── Computed metrics ────────────────────────────────────────────────────────

  // Target health
  const targetHealth = {
    on_track: targets.filter(t => t.status === 'on_track').length,
    at_risk:  targets.filter(t => t.status === 'at_risk').length,
    off_track:targets.filter(t => t.status === 'off_track').length,
    achieved: targets.filter(t => t.status === 'achieved').length,
    missed:   targets.filter(t => t.status === 'missed').length,
  };
  const totalTargets = targets.length || 1;

  // Activity status breakdown
  const actStatus = {
    pending:     activities.filter(a => a.status === 'pending').length,
    in_progress: activities.filter(a => a.status === 'in_progress').length,
    completed:   activities.filter(a => a.status === 'completed').length,
    overdue:     activities.filter(a => a.status === 'overdue').length,
    on_hold:     activities.filter(a => a.status === 'on_hold').length,
    cancelled:   activities.filter(a => a.status === 'cancelled').length,
  };
  const totalActs = activities.length || 1;

  // Bottlenecks: activities in_progress > 14 days old
  const now = Date.now();
  const stuckActivities = activities
    .filter(a => a.status === 'in_progress' && a.start_date)
    .map(a => ({ ...a, daysStuck: Math.floor((now - new Date(a.start_date!).getTime()) / 86400000) }))
    .filter(a => a.daysStuck > 14)
    .sort((a, b) => (b as any).daysStuck - (a as any).daysStuck)
    .slice(0, 6);

  // At-risk targets
  const atRiskTargets = targets
    .filter(t => t.status === 'at_risk' || t.status === 'off_track')
    .slice(0, 5);

  // Overdue activities
  const overdueActs = activities
    .filter(a => a.status === 'overdue' || (a.end_date && new Date(a.end_date) < new Date() && !['completed','cancelled'].includes(a.status)))
    .slice(0, 6);

  // Missed targets
  const missedTargets = targets.filter(t => t.status === 'missed').slice(0, 5);

  // Completion trend: activities completed per week (last 8 weeks)
  const weeks: { label: string; count: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const weekEnd   = new Date(now - w * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const count = activities.filter(a => {
      if (a.status !== 'completed') return false;
      const updated = a.updated_at ? new Date(a.updated_at) : null;
      return updated && updated >= weekStart && updated < weekEnd;
    }).length;
    const label = weekEnd.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
    weeks.push({ label, count });
  }

  // Objective lag: objectives with 0 completed activities
  const objLag = objectives.map(o => {
    const objActs = activities.filter(a => a.target_id && targets.find(t => t.objective_id === o.objective_id && t.target_id === a.target_id));
    const completed = objActs.filter(a => a.status === 'completed').length;
    const pct = objActs.length ? Math.round((completed / objActs.length) * 100) : 0;
    return { ...o, totalActs: objActs.length, completedActs: completed, pct };
  }).sort((a, b) => a.pct - b.pct).slice(0, 5);

  // Workload: assigned user activity count
  const workload: Record<number, { name: string; count: number; overdue: number }> = {};
  activities.forEach(a => {
    if (!a.assigned_user_id) return;
    if (!workload[a.assigned_user_id]) {
      const u = users.find(u => u.user_id === a.assigned_user_id);
      workload[a.assigned_user_id] = { name: u?.full_name ?? `User #${a.assigned_user_id}`, count: 0, overdue: 0 };
    }
    workload[a.assigned_user_id].count++;
    if (a.status === 'overdue') workload[a.assigned_user_id].overdue++;
  });
  const topWorkload = Object.values(workload).sort((a, b) => b.count - a.count).slice(0, 6);
  const maxLoad = Math.max(...topWorkload.map(w => w.count), 1);

  // Helpers
  const pct = (n: number, total: number) => total ? Math.round((n / total) * 100) : 0;
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—';

  const STATUS_COLORS: Record<string, string> = {
    on_track: '#639922', at_risk: '#BA7517', off_track: '#A32D2D',
    achieved: '#1D9E75', missed: '#E24B4A',
    pending: '#888780', in_progress: '#378ADD', completed: '#1D9E75',
    overdue: '#E24B4A', on_hold: '#BA7517', cancelled: '#888780',
  };

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 ${className}`}>
      {children}
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{children}</h2>
  );

  const MetricPill = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct(value, totalTargets)}%`, background: color }} />
        </div>
        <span className="text-sm font-medium text-gray-800 dark:text-white w-6 text-right">{value}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Analysis Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {activities.length} activities · {targets.length} targets · {objectives.length} objectives
        </p>
      </div>

      {/* ── Row 1: Health + Activity Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Project Health */}
        <Card>
          <SectionTitle>Project Health Overview</SectionTitle>
          <div className="space-y-1">
            <MetricPill label="On Track"  value={targetHealth.on_track}  color={STATUS_COLORS.on_track} />
            <MetricPill label="At Risk"   value={targetHealth.at_risk}   color={STATUS_COLORS.at_risk} />
            <MetricPill label="Off Track" value={targetHealth.off_track} color={STATUS_COLORS.off_track} />
            <MetricPill label="Achieved"  value={targetHealth.achieved}  color={STATUS_COLORS.achieved} />
            <MetricPill label="Missed"    value={targetHealth.missed}    color={STATUS_COLORS.missed} />
          </div>
          <div className="mt-4 flex rounded-lg overflow-hidden h-3">
            {(Object.entries(targetHealth) as [string, number][]).map(([k, v]) => v > 0 && (
              <div key={k} title={k} style={{ width: `${pct(v, totalTargets)}%`, background: STATUS_COLORS[k] }} />
            ))}
          </div>
          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-2xl font-bold text-gray-800 dark:text-white">
              {pct(targetHealth.on_track + targetHealth.achieved, totalTargets)}%
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">targets healthy</span>
          </div>
        </Card>

        {/* Activity Status */}
        <Card>
          <SectionTitle>Activity Status Breakdown</SectionTitle>
          <div className="space-y-1">
            {([
              ['Completed',   actStatus.completed,   STATUS_COLORS.completed],
              ['In Progress', actStatus.in_progress, STATUS_COLORS.in_progress],
              ['Pending',     actStatus.pending,     STATUS_COLORS.pending],
              ['Overdue',     actStatus.overdue,     STATUS_COLORS.overdue],
              ['On Hold',     actStatus.on_hold,     STATUS_COLORS.on_hold],
              ['Cancelled',   actStatus.cancelled,   STATUS_COLORS.cancelled],
            ] as [string, number, string][]).map(([label, count, color]) => (
              <div key={label} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct(count, totalActs)}%`, background: color }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{pct(count, totalActs)}%</span>
                  <span className="text-sm font-medium text-gray-800 dark:text-white w-5 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row 2: Completion Trend ── */}
      <Card>
        <SectionTitle>Completion Trend (last 8 weeks)</SectionTitle>
        {weeks.every(w => w.count === 0) ? (
          <p className="text-sm text-gray-400 text-center py-6">No completed activities in the last 8 weeks</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {weeks.map((w, i) => {
              const maxCount = Math.max(...weeks.map(x => x.count), 1);
              const barH = Math.round((w.count / maxCount) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{w.count > 0 ? w.count : ''}</span>
                  <div className="w-full rounded-t-sm transition-all" style={{
                    height: `${barH}%`,
                    minHeight: w.count > 0 ? '4px' : '2px',
                    background: w.count > 0 ? '#1D9E75' : '#e5e7eb',
                  }} />
                  <span className="text-[10px] text-gray-400 truncate w-full text-center">{w.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Row 3: Bottlenecks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Stuck activities */}
        <Card>
          <SectionTitle>
            Bottlenecks — Activities stuck in progress
            {stuckActivities.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">
                {stuckActivities.length}
              </span>
            )}
          </SectionTitle>
          {stuckActivities.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No activities stuck over 14 days</p>
          ) : (
            <div className="space-y-2">
              {stuckActivities.map(a => (
                <div key={a.activity_id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{a.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.assigned_user_name ?? 'Unassigned'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                      {(a as any).daysStuck}d
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* At-risk targets */}
        <Card>
          <SectionTitle>
            Bottlenecks — Targets at risk
            {atRiskTargets.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">
                {atRiskTargets.length}
              </span>
            )}
          </SectionTitle>
          {atRiskTargets.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No targets at risk</p>
          ) : (
            <div className="space-y-2">
              {atRiskTargets.map(t => (
                <div key={t.target_id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Deadline: {fmtDate(t.deadline)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                    t.status === 'at_risk'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                  }`}>{t.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Risk Signals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Overdue activities */}
        <Card>
          <SectionTitle>
            Risk Signals — Overdue activities
            {overdueActs.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                {overdueActs.length}
              </span>
            )}
          </SectionTitle>
          {overdueActs.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No overdue activities</p>
          ) : (
            <div className="space-y-2">
              {overdueActs.map(a => (
                <div key={a.activity_id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{a.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Due: {fmtDate(a.end_date)} · {a.assigned_user_name ?? 'Unassigned'}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Missed targets */}
        <Card>
          <SectionTitle>
            Risk Signals — Missed targets
            {missedTargets.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                {missedTargets.length}
              </span>
            )}
          </SectionTitle>
          {missedTargets.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No missed targets</p>
          ) : (
            <div className="space-y-2">
              {missedTargets.map(t => (
                <div key={t.target_id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.current_value}/{t.target_value} {t.unit} · Deadline: {fmtDate(t.deadline)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      {t.target_value > 0 ? Math.round((t.current_value / t.target_value) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-gray-400">achieved</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 5: Performance Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Lagging objectives */}
        <Card>
          <SectionTitle>Performance — Objectives lagging</SectionTitle>
          {objLag.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No objectives found</p>
          ) : (
            <div className="space-y-3">
              {objLag.map(o => (
                <div key={o.objective_id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{o.title}</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {o.completedActs}/{o.totalActs} done
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${o.pct}%`, background: o.pct >= 70 ? '#1D9E75' : o.pct >= 30 ? '#BA7517' : '#E24B4A' }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{o.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Team workload */}
        <Card>
          <SectionTitle>Performance — Team workload</SectionTitle>
          {topWorkload.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No assigned activities</p>
          ) : (
            <div className="space-y-3">
              {topWorkload.map(w => (
                <div key={w.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center text-brand-700 dark:text-brand-400 text-[10px] font-bold flex-shrink-0">
                        {w.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{w.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {w.overdue > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                          {w.overdue} overdue
                        </span>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">{w.count}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((w.count / maxLoad) * 100)}%`,
                        background: w.count / maxLoad > 0.8 ? '#E24B4A' : w.count / maxLoad > 0.5 ? '#BA7517' : '#378ADD',
                      }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
