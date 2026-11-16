import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { planApi } from '../../api';
import type { PlanData, PlanRow } from '../../api/plan';
import { useAuth } from '../../store/authStore';
import PlanImportModal from '../../components/tpfcs/PlanImportModal';

const WEEKS_PER_MONTH = 4.345;
const CELL = 18; // px per week column
const ROW_H = 30;
const LEFT_W = { code: 56, task: 340, lead: 120, after: 90, start: 52, end: 52 };

const monthOfWeek = (w: number) => Math.floor((w - 1) / WEEKS_PER_MONTH) + 1;
const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** A task "starts early" when it begins in an earlier week than a predecessor ends. */
function startsEarly(row: PlanRow, byCode: Map<string, PlanRow>): boolean {
  return row.after.some((code) => {
    const p = byCode.get(code);
    if (!p) return false;
    if (row.start_week && p.end_week) return row.start_week < p.end_week;
    return !!(row.start_date && p.end_date && row.start_date < p.end_date);
  });
}

export default function ProjectPlan() {
  const { id } = useParams();
  const pid = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    planApi.get(pid)
      .then((r) => { setPlan(r.data); setError(''); })
      .catch((e) => setError(e?.response?.data?.message ?? 'Failed to load plan'))
      .finally(() => setLoading(false));
  }, [pid]);

  useEffect(load, [load]);

  const doExport = async (kind: 'xlsx' | 'pdf') => {
    setExporting(kind);
    try {
      await (kind === 'xlsx' ? planApi.exportExcel(pid) : planApi.exportPdf(pid));
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const weeks = plan?.project.total_weeks ?? 0;
  const base = plan?.project.base_date ?? null;

  const byCode = useMemo(() => new Map((plan?.rows ?? []).map((r) => [r.code, r])), [plan]);

  const months = useMemo(() => {
    const out: { month: number; first: number; last: number }[] = [];
    for (let w = 1; w <= weeks; w += 1) {
      const m = monthOfWeek(w);
      const last = out[out.length - 1];
      if (last && last.month === m) last.last = w; else out.push({ month: m, first: w, last: w });
    }
    return out;
  }, [weeks]);

  const todayWeek = useMemo(() => {
    if (!base || !weeks) return null;
    const diff = Date.now() - new Date(`${base}T00:00:00Z`).getTime();
    const w = Math.floor(diff / (7 * 86400000)) + 1;
    return w >= 1 && w <= weeks ? w : null;
  }, [base, weeks]);

  const visible = useMemo(() => {
    if (!plan) return [];
    const q = search.trim().toLowerCase();
    const matches = (r: PlanRow) =>
      !q || r.code.toLowerCase().startsWith(q) || r.name.toLowerCase().includes(q) || (r.lead ?? '').toLowerCase().includes(q);
    const objectivesWithHit = new Set(plan.rows.filter((r) => r.type === 'activity' && matches(r)).map((r) => r.objective_id));
    return plan.rows.filter((r) => {
      if (r.type === 'objective') return !q || matches(r) || objectivesWithHit.has(r.objective_id);
      if (q) return matches(r);
      return !collapsed.has(r.objective_id);
    });
  }, [plan, search, collapsed]);

  const toggle = (objectiveId: number) =>
    setCollapsed((s) => { const n = new Set(s); if (n.has(objectiveId)) n.delete(objectiveId); else n.add(objectiveId); return n; });

  const objectives = plan?.rows.filter((r) => r.type === 'objective') ?? [];
  const taskCount = plan?.rows.filter((r) => r.type === 'activity').length ?? 0;
  const gridW = weeks * CELL;
  const leftW = Object.values(LEFT_W).reduce((a, b) => a + b, 0);
  const sticky = LEFT_W.code + LEFT_W.task;

  if (loading && !plan) return <div className="p-6 text-gray-400">Loading plan…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <Link to={`/projects/${pid}`} className="text-xs text-brand-500 hover:underline">← Back to project</Link>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white mt-1">{plan?.project.name ?? 'Plan'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Implementation plan · {objectives.length} sections · {taskCount} tasks
            {weeks > 0 && <> · {weeks} weeks{base && <> · Week 1 starts {fmtDate(base)}</>}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => doExport('xlsx')} disabled={exporting !== null || !taskCount}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50">
            {exporting === 'xlsx' ? 'Preparing…' : 'Export Excel'}
          </button>
          <button onClick={() => doExport('pdf')} disabled={exporting !== null || !taskCount}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50">
            {exporting === 'pdf' ? 'Preparing…' : 'Export PDF'}
          </button>
          {canManage && (
            <button onClick={() => setShowImport(true)}
              className="px-3 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
              Import plan
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}

      {!taskCount ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-1">This project has no scheduled activities yet.</p>
          <p className="text-sm text-gray-400">
            {canManage
              ? 'Import a plan from the Excel template, or add objectives, targets and activities from the project page.'
              : 'Activities will appear here once they are added.'}
          </p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by WBS, task or lead…"
              className="w-64 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400" />
            <button onClick={() => setCollapsed(new Set(objectives.map((o) => o.objective_id)))}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-500">Collapse all</button>
            <button onClick={() => setCollapsed(new Set())}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-500">Expand all</button>
            <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
              <span className="flex items-center gap-1"><i className="inline-block w-3 h-2 rounded-sm bg-[#1F2A44]" />Section</span>
              <span className="flex items-center gap-1"><i className="inline-block w-3 h-2 rounded-sm bg-[#2E6FD8]" />Task</span>
              <span className="flex items-center gap-1"><i className="inline-block w-3 h-2 rounded-sm bg-[#1E9E5A]" />Done</span>
              <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full bg-amber-500" />Starts before predecessor ends</span>
            </div>
          </div>

          {/* Gantt */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-auto max-h-[75vh]">
            <div style={{ width: leftW + gridW, minWidth: '100%' }} className="text-xs">
              {/* header */}
              <div className="sticky top-0 z-30 bg-[#1F2A44] text-white">
                <div className="flex" style={{ height: 22 }}>
                  <div className="sticky left-0 z-40 bg-[#1F2A44]" style={{ width: sticky }} />
                  <div style={{ width: leftW - sticky }} />
                  <div className="relative" style={{ width: gridW }}>
                    {months.map((m) => (
                      <div key={m.month} className="absolute top-0 h-full flex items-center justify-center border-l border-white/20 font-semibold"
                        style={{ left: (m.first - 1) * CELL, width: (m.last - m.first + 1) * CELL }}>
                        M{m.month}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex font-semibold" style={{ height: 26 }}>
                  <div className="sticky left-0 z-40 bg-[#1F2A44] flex items-center" style={{ width: sticky }}>
                    <span className="px-2" style={{ width: LEFT_W.code }}>WBS</span>
                    <span className="px-2">TASK</span>
                  </div>
                  <div className="flex items-center" style={{ width: leftW - sticky }}>
                    <span className="px-2" style={{ width: LEFT_W.lead }}>LEAD</span>
                    <span className="px-2" style={{ width: LEFT_W.after }}>AFTER</span>
                    <span className="px-2" style={{ width: LEFT_W.start }}>START</span>
                    <span className="px-2" style={{ width: LEFT_W.end }}>END</span>
                  </div>
                  <div className="flex" style={{ width: gridW }}>
                    {Array.from({ length: weeks }, (_, i) => (
                      <div key={i} className="text-[9px] text-center leading-[26px] text-white/80" style={{ width: CELL }}>{i + 1}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* rows */}
              {visible.map((r) => {
                const isObj = r.type === 'objective';
                const early = !isObj && startsEarly(r, byCode);
                const rowBg = isObj ? 'bg-[#DCE6F2] dark:bg-[#26334f]' : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800';
                const barBase = isObj ? '#1F2A44' : r.progress >= 100 ? '#1E9E5A' : '#2E6FD8';
                return (
                  <div key={`${r.type}-${r.id}`} className={`flex border-b border-gray-100 dark:border-gray-800 ${rowBg} group`} style={{ height: ROW_H }}>
                    <div className={`sticky left-0 z-20 flex items-center ${isObj ? 'bg-[#DCE6F2] dark:bg-[#26334f]' : 'bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800'}`} style={{ width: sticky }}>
                      <span className={`px-2 font-mono ${isObj ? 'font-bold' : ''} ${r.has_code ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 italic'}`}
                        style={{ width: LEFT_W.code }} title={r.has_code ? 'WBS code' : 'Generated code — set a WBS code on the item to keep it fixed'}>
                        {r.code}
                      </span>
                      <div className="flex items-center gap-1 pr-2 min-w-0" style={{ width: LEFT_W.task, paddingLeft: Math.max(r.depth - 2, 0) * 14 }}>
                        {isObj && (
                          <button onClick={() => toggle(r.objective_id)} className="text-gray-500 w-4 shrink-0" aria-label="Toggle section">
                            {collapsed.has(r.objective_id) ? '▸' : '▾'}
                          </button>
                        )}
                        {early && <i className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Starts before a predecessor finishes" />}
                        {isObj ? (
                          <span className="font-bold text-gray-800 dark:text-white truncate" title={r.name}>{r.name}</span>
                        ) : (
                          <Link to={`/activities/${r.id}`} className="truncate text-gray-700 dark:text-gray-200 hover:text-brand-500" title={r.name}>{r.name}</Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400" style={{ width: leftW - sticky }}>
                      <span className="px-2 truncate" style={{ width: LEFT_W.lead }} title={r.lead ?? ''}>{r.lead}</span>
                      <span className="px-2 truncate" style={{ width: LEFT_W.after }} title={r.after.join(', ')}>{r.after.join(', ')}</span>
                      <span className="px-2" style={{ width: LEFT_W.start }}>{r.start_week ? `W${r.start_week}` : ''}</span>
                      <span className="px-2" style={{ width: LEFT_W.end }}>{r.end_week ? `W${r.end_week}` : ''}</span>
                    </div>
                    <div className="relative" style={{ width: gridW }}>
                      {todayWeek && (
                        <div className="absolute top-0 bottom-0 w-px bg-red-400/70" style={{ left: (todayWeek - 0.5) * CELL }} />
                      )}
                      {r.start_week && r.end_week && (
                        <div className="absolute rounded-sm overflow-hidden"
                          style={{
                            left: (r.start_week - 1) * CELL + 1,
                            width: Math.max((Math.min(r.end_week, weeks) - r.start_week + 1) * CELL - 2, 4),
                            top: isObj ? 11 : 8, height: isObj ? 8 : 14,
                            background: isObj ? barBase : `${barBase}55`,
                          }}
                          title={`${r.code} ${r.name}\n${fmtDate(r.start_date)} – ${fmtDate(r.end_date)} · ${r.progress}%`}>
                          {!isObj && <div style={{ width: `${Math.min(r.progress, 100)}%`, height: '100%', background: barBase }} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <PlanImportModal isOpen={showImport} onClose={() => setShowImport(false)} projectId={pid}
        defaultStartDate={base ?? undefined}
        onImported={() => { setShowImport(false); load(); }} />
    </div>
  );
}
