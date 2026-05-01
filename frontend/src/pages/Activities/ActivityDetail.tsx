import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { activitiesApi, budgetApi } from '../../api';
import type { Activity, ActivityStatusHistory, BudgetRevision, ActivityStatus } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';
import Modal from '../../components/tpfcs/Modal';
import { FormSelect, FormTextArea } from '../../components/tpfcs/FormField';
import { useAuth } from '../../store/authStore';
import BackButton from '../../components/tpfcs/BackButton';

// Status transition map (mirrors backend)
const TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  pending:     ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled', 'overdue'],
  on_hold:     ['in_progress', 'cancelled'],
  overdue:     ['in_progress', 'on_hold', 'cancelled', 'completed'],
  completed:   [],
  cancelled:   [],
};

export default function ActivityDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const aid      = Number(id);

  const [activity,   setActivity]   = useState<Activity | null>(null);
  const [history,    setHistory]    = useState<ActivityStatusHistory[]>([]);
  const [revisions,  setRevisions]  = useState<BudgetRevision[]>([]);
  const [subActivities, setSubActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<'details' | 'history' | 'budget' | 'sub'>('details');

  // Modals
  const [statusModal,   setStatusModal]   = useState(false);
  const [revisionModal, setRevisionModal] = useState(false);
  const [deleteModal,   setDeleteModal]   = useState(false);

  // Status update form
  const [newStatus,  setNewStatus]  = useState<ActivityStatus>('in_progress');
  const [progress,   setProgress]   = useState('');
  const [updating,   setUpdating]   = useState(false);
  const [statusErr,  setStatusErr]  = useState('');

  // Budget revision form
  const [reqAmount,  setReqAmount]  = useState('');
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revErr,     setRevErr]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, hRes] = await Promise.all([
        activitiesApi.get(aid),
        activitiesApi.getHistory(aid),
      ]);
      setActivity(aRes.data);
      setHistory(hRes.data);
      budgetApi.listRevisions({ activity_id: aid })
        .then(r => setRevisions(r.data)).catch(() => {});
      activitiesApi.getSubActivities(aid)
        .then(r => setSubActivities(r.data)).catch(() => {});
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [aid]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusErr(''); setUpdating(true);
    try {
      await activitiesApi.update(aid, {
        status: newStatus,
        ...(progress ? { progress: Number(progress) } : {}),
      });
      setStatusModal(false); load();
      toast.success('Status updated', `Activity is now ${newStatus.replace('_',' ')}`);
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed to update status'; toast.error('Update failed', m); setStatusErr(m);
    } finally { setUpdating(false); }
  };

  const handleRevisionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevErr(''); setSubmitting(true);
    try {
      await budgetApi.requestRevision(aid, Number(reqAmount), reason);
      setRevisionModal(false); setReqAmount(''); setReason('');
      load();
    } catch (err: any) {
      setRevErr(err?.response?.data?.message ?? 'Failed to submit revision');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    await activitiesApi.delete(aid);
    navigate('/activities');
  };

  const fmt  = (n?: number | null) => n != null ? `TZS ${Number(n).toLocaleString()}` : '—';
  const dt   = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const isTerminal = activity && (activity.status === 'completed' || activity.status === 'cancelled');
  const allowedNext = activity ? (TRANSITIONS[activity.status] ?? []) : [];

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
      <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  );

  if (!activity) return <div className="text-center py-16 text-gray-400">Activity not found</div>;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/activities" className="hover:text-brand-500">Activities</Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{activity.name}</span>
        </div>
        <BackButton to="/activities" />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">{activity.name}</h1>
            <StatusBadge status={activity.status} size="md" />
          </div>
          {activity.target_name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Target: {activity.target_name}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isTerminal && (
            <button onClick={() => { setNewStatus(allowedNext[0] ?? 'in_progress'); setProgress(String(activity.progress)); setStatusErr(''); setStatusModal(true); }}
              className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
              Update Status
            </button>
          )}
          <Link to={`/activities/${aid}/edit`}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            Edit
          </Link>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button onClick={() => setDeleteModal(true)}
              className="px-4 py-2 text-sm border border-red-300 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3 text-sm">
          <div><p className="text-xs text-gray-400">Progress</p><p className="font-bold text-2xl text-brand-600 dark:text-brand-400">{activity.progress}%</p></div>
          <div><p className="text-xs text-gray-400">Budget</p><p className="font-semibold text-gray-800 dark:text-white">{fmt(activity.effective_budget)}</p></div>
          <div><p className="text-xs text-gray-400">Start</p><p className="font-medium text-gray-700 dark:text-gray-300">{dt(activity.start_date)}</p></div>
          <div><p className="text-xs text-gray-400">End</p><p className="font-medium text-gray-700 dark:text-gray-300">{dt(activity.end_date)}</p></div>
        </div>
        <BudgetBar value={activity.progress} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'details',  label: 'Details' },
          { key: 'history',  label: `Status History (${history.length})` },
          { key: 'budget',    label: `Budget (${revisions.length} revisions)` },
      { key: 'sub',       label: `Sub-Activities (${subActivities.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Region',          value: activity.region_name },
            { label: 'Council',         value: activity.council },
            { label: 'Ward',            value: activity.ward },
            { label: 'Street',          value: activity.street },
            { label: 'Road',            value: activity.road_name },
            { label: 'Assigned To',     value: activity.assigned_user_name },
            { label: 'Supervisor',      value: activity.supervisor_name },
            { label: 'Budgeted',        value: fmt(activity.budgeted_amount) },
            { label: 'Revised Budget',  value: activity.revised_amount ? fmt(activity.revised_amount) : null },
            { label: 'Coordinates',     value: activity.latitude && activity.longitude ? `${activity.latitude}, ${activity.longitude}` : null },
          ].filter(i => i.value).map(i => (
            <div key={i.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-400 mb-0.5">{i.label}</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white">{i.value}</p>
            </div>
          ))}
          {activity.description && (
            <div className="col-span-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{activity.description}</p>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          {history.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">No status changes yet</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex items-center gap-2 flex-1">
                    <StatusBadge status={h.old_status} />
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <StatusBadge status={h.new_status} />
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>{h.changed_by_name}</p>
                    <p>{dt(h.changed_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Budget tab */}
      {tab === 'budget' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Original Budget',  value: fmt(activity.budgeted_amount) },
              { label: 'Revised Budget',   value: activity.revised_amount ? fmt(activity.revised_amount) : 'Not revised' },
              { label: 'Effective Budget', value: fmt(activity.effective_budget) },
            ].map(i => (
              <div key={i.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <p className="text-xs text-gray-400 mb-1">{i.label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{i.value}</p>
              </div>
            ))}
          </div>

          {!isTerminal && (
            <button onClick={() => { setReqAmount(''); setReason(''); setRevErr(''); setRevisionModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20">
              Request Budget Revision
            </button>
          )}

          {revisions.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Revision Requests</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {revisions.map(r => (
                  <div key={r.revision_id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{fmt(r.requested_amount)}</p>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        r.status === 'pending'  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                        r.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                                  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      }`}>{r.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{r.reason}</p>
                    <p className="text-xs text-gray-400 mt-1">{dt(r.created_at)} · {r.requested_by_name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Activities Tab */}
      {tab === 'sub' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link
              to={`/activities/new?main_activity_id=${aid}&target_id=${activity.target_id}`}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Sub-Activity
            </Link>
          </div>
          {subActivities.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No sub-activities yet</div>
          ) : subActivities.map(s => (
            <div key={s.activity_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{s.name}</h3>
                  <StatusBadge status={s.status} />
                </div>
                <Link to={`/activities/${s.activity_id}`} className="text-xs text-brand-500 hover:text-brand-600">View →</Link>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                <div><p className="text-gray-400">Budget</p><p className="font-medium text-gray-700 dark:text-gray-300">TZS {Number(s.effective_budget).toLocaleString()}</p></div>
                <div><p className="text-gray-400">Progress</p><p className="font-medium text-gray-700 dark:text-gray-300">{s.progress}%</p></div>
                <div><p className="text-gray-400">Status</p><p className="font-medium text-gray-700 dark:text-gray-300 capitalize">{s.status.replace('_',' ')}</p></div>
              </div>
              <BudgetBar value={s.progress} />
            </div>
          ))}
        </div>
      )}

      {/* Update Status Modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Update Activity Status" size="sm">
        <form onSubmit={handleStatusUpdate} className="space-y-4">
          {statusErr && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{statusErr}</p>}
          <FormSelect label="New Status" value={newStatus} onChange={e => setNewStatus(e.target.value as ActivityStatus)}>
            {allowedNext.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </FormSelect>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Progress (%) — current: {activity.progress}%
            </label>
            <input type="number" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setStatusModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
            <button type="submit" disabled={updating} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{updating ? 'Updating...' : 'Update'}</button>
          </div>
        </form>
      </Modal>

      {/* Budget Revision Modal */}
      <Modal isOpen={revisionModal} onClose={() => setRevisionModal(false)} title="Request Budget Revision" size="sm">
        <form onSubmit={handleRevisionRequest} className="space-y-4">
          {revErr && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{revErr}</p>}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current effective budget: <strong className="text-gray-700 dark:text-gray-300">{fmt(activity.effective_budget)}</strong>
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Requested Amount (TZS) <span className="text-red-500">*</span></label>
            <input type="number" value={reqAmount} onChange={e => setReqAmount(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              placeholder="Must be greater than current budget" />
          </div>
          <FormTextArea label="Justification" required value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why extra budget is needed (min 10 characters)" />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setRevisionModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Request'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Activity" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to delete <strong className="text-gray-800 dark:text-white">"{activity.name}"</strong>? This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
