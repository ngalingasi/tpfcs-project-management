import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { activitiesApi } from '../../api';
import type { Activity, PaginatedResponse, ActivityStatus } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';

const STATUS_OPTIONS: ActivityStatus[] = ['pending','in_progress','on_hold','completed','cancelled','overdue'];

export default function ActivityList() {
  const [data,    setData]    = useState<PaginatedResponse<Activity> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activitiesApi.list({ page, limit: 15, status: status || undefined });
      setData(res.data);
    } catch {
      setError('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => `TZS ${Number(n).toLocaleString()}`;

  return (
    <div className="p-4 sm:p-6">
      <PageBreadCrumb pageTitle="Activities" />

      <div className="mb-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <Link
          to="/activities/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Activity
        </Link>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))
        ) : data?.results.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No activities found</div>
        ) : (
          data?.results.map((a) => (
            <div key={a.activity_id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white truncate">{a.name}</h3>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    {a.target_name && <span>Target: {a.target_name}</span>}
                    {a.region_name && <span>📍 {a.region_name}</span>}
                    {a.assigned_user_name && <span>👤 {a.assigned_user_name}</span>}
                  </div>
                </div>
                <Link to={`/activities/${a.activity_id}`}
                  className="flex-shrink-0 text-xs text-brand-500 hover:text-brand-600 font-medium">
                  View →
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-gray-400">Budget</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{fmt(a.effective_budget)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Dates</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    {a.start_date ? new Date(a.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—'}
                    {a.end_date ? ` – ${new Date(a.end_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Progress</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{a.progress}%</p>
                </div>
              </div>
              <div className="mt-2">
                <BudgetBar value={a.progress} />
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {data.page} of {data.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page === data.totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
