import { useMemo } from 'react';
import Modal from './Modal';
import ActivityLink from './ActivityLink';
import StatusBadge from './StatusBadge';
import type { Activity, Target } from '../../types';

interface Props {
  target: Target | null;
  activities: Activity[];
  onClose: () => void;
}

const natural = (a?: string | null, b?: string | null) =>
  (a ?? '').localeCompare(b ?? '', undefined, { numeric: true });

const fmt = (n?: number | string | null) => (n != null && n !== '' ? Number(n).toLocaleString() : '—');
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

/** Read-only list of one target's activities (sub-activities indented under their main activity). */
export default function TargetActivitiesModal({ target, activities, onClose }: Props) {
  const rows = useMemo(() => {
    if (!target) return [] as { a: Activity; depth: number }[];
    const mine = activities.filter(a => a.target_id === target.target_id);
    const ids = new Set(mine.map(a => a.activity_id));
    const sorter = (x: Activity, y: Activity) =>
      (x.sort_order ?? 0) - (y.sort_order ?? 0) || natural(x.wbs_code, y.wbs_code) || x.activity_id - y.activity_id;
    const children = new Map<number, Activity[]>();
    const roots: Activity[] = [];
    mine.forEach(a => {
      if (a.main_activity_id && ids.has(a.main_activity_id)) {
        children.set(a.main_activity_id, [...(children.get(a.main_activity_id) ?? []), a]);
      } else roots.push(a);
    });
    const out: { a: Activity; depth: number }[] = [];
    roots.sort(sorter).forEach(r => {
      out.push({ a: r, depth: 0 });
      (children.get(r.activity_id) ?? []).sort(sorter).forEach(c => out.push({ a: c, depth: 1 }));
    });
    return out;
  }, [target, activities]);

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      size="xl"
      title={target ? `Activities — ${target.name}` : 'Activities'}
    >
      {rows.length === 0 ? (
        <p className="text-center py-8 text-sm text-gray-400">No activities for this target yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 px-2 font-medium">Activity</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium w-32">Progress</th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">Dates</th>
                <th className="py-2 px-2 font-medium text-right">Budget (TZS)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, depth }) => (
                <tr key={a.activity_id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2.5 px-2" style={{ paddingLeft: depth ? '1.75rem' : undefined }}>
                    <ActivityLink id={a.activity_id} className="text-gray-800 dark:text-white hover:text-brand-500">
                      {a.wbs_code && <span className="font-mono text-xs text-gray-400 mr-1.5">{a.wbs_code}</span>}
                      {a.name}
                    </ActivityLink>
                  </td>
                  <td className="py-2.5 px-2"><StatusBadge status={a.status} /></td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, Math.max(0, Number(a.progress) || 0))}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{Math.round(Number(a.progress) || 0)}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(a.start_date)} – {fmtDate(a.end_date)}</td>
                  <td className="py-2.5 px-2 text-right text-gray-700 dark:text-gray-300">{fmt(a.effective_budget ?? a.budgeted_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
