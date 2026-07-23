import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { activitiesApi, budgetApi } from '../../api';
import type { Activity, ActivityStatusHistory, BudgetRevision, ActivityStatus } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';
import Modal from '../../components/tpfcs/Modal';
import { FormSelect, FormTextArea } from '../../components/tpfcs/FormField';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import FilePreview from '../../components/tpfcs/FilePreview';
import RichTextDisplay from '../../components/tpfcs/RichTextDisplay';

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
  const [comments,      setComments]      = useState<any[]>([]);
  const [documents,     setDocuments]     = useState<any[]>([]);
  const [pictures,      setPictures]      = useState<any[]>([]);
  const [commentText,   setCommentText]   = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [previewDoc,    setPreviewDoc]    = useState<{url:string;name:string;mime?:string;documentId?:number;description?:string|null;category?:'document'|'picture';doc?:any}|null>(null);
  const [docComments,   setDocComments]   = useState<any[]>([]);
  const [uploadModal,   setUploadModal]   = useState<'document' | 'picture' | null>(null);
  const [uploadForm,    setUploadForm]    = useState({ name: '', description: '', file: null as File | null });
  const [uploading,     setUploading]     = useState(false);
  const [payments,      setPayments]      = useState<any[]>([]);
  const [paySummary,    setPaySummary]    = useState<any>(null);
  const [showPayForm,   setShowPayForm]   = useState(false);
  const [payForm,       setPayForm]       = useState({ amount: '', payment_date: new Date().toISOString().slice(0,10), payment_method: '', reference_no: '', payee: '', description: '', status: 'pending' });
  const [payFile,       setPayFile]       = useState<File | null>(null);
  const [savingPay,     setSavingPay]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<'details' | 'history' | 'documents' | 'pictures' | 'sub' | 'comments' | 'budget' | 'payments'>('details');

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
      const aRes = await activitiesApi.get(aid);
      setActivity(aRes.data);
      activitiesApi.getHistory(aid).then(r => setHistory(r.data)).catch(() => {});
      budgetApi.listRevisions({ activity_id: aid })
        .then(r => setRevisions(r.data)).catch(() => {});
      activitiesApi.getSubActivities(aid)
        .then(r => setSubActivities(r.data)).catch(() => {});
      activitiesApi.getComments(aid)
        .then(r => setComments(r.data)).catch(() => {});
      activitiesApi.getPayments(aid)
        .then(r => setPayments(r.data)).catch(() => {});
      activitiesApi.getPaymentSummary(aid)
        .then(r => setPaySummary(r.data)).catch(() => {});
      activitiesApi.getDocuments(aid, 'document')
        .then(r => setDocuments(r.data)).catch(() => {});
      activitiesApi.getDocuments(aid, 'picture')
        .then(r => setPictures(r.data)).catch(() => {});
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

  const openUploadModal = (category: 'document' | 'picture') => {
    setUploadForm({ name: '', description: '', file: null });
    setUploadModal(category);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) { toast.error('File required', 'Please choose a file to upload'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('name', uploadForm.name.trim() || uploadForm.file.name);
      fd.append('description', uploadForm.description.trim());
      fd.append('category', uploadModal === 'picture' ? 'picture' : 'document');
      const res = await activitiesApi.uploadDocument(aid, fd);
      if (uploadModal === 'picture') {
        setPictures(prev => [res.data, ...prev]);
      } else {
        setDocuments(prev => [res.data, ...prev]);
      }
      toast.success(uploadModal === 'picture' ? 'Picture uploaded' : 'Document uploaded', res.data.name);
      setUploadModal(null);
    } catch (err: any) {
      toast.error('Upload failed', err?.response?.data?.message ?? 'Could not upload file');
    } finally {
      setUploading(false);
    }
  };

  const openDocPreview = async (doc: any, category: 'document' | 'picture' = 'document') => {
    setPreviewDoc({ url: fileUrl(doc), name: doc.name, mime: doc.mime_type, documentId: doc.document_id, description: doc.description, category, doc });
    setDocComments([]);
    try {
      const res = await activitiesApi.getDocumentComments(aid, doc.document_id);
      setDocComments(res.data);
    } catch { /* ignore */ }
  };

  const handleAddDocComment = async (text: string) => {
    if (!previewDoc?.documentId) return;
    try {
      const res = await activitiesApi.addDocumentComment(aid, previewDoc.documentId, text);
      setDocComments(prev => [...prev, res.data]);
      // Keep the underlying list's comment_count roughly in sync
      const bump = (list: any[]) => list.map(d => d.document_id === previewDoc.documentId ? { ...d, comment_count: (d.comment_count ?? 0) + 1 } : d);
      setDocuments(bump);
      setPictures(bump);
    } catch (err: any) {
      toast.error('Failed to add comment', err?.response?.data?.message);
    }
  };

  const handleDeleteDocComment = async (commentId: number) => {
    if (!previewDoc?.documentId) return;
    try {
      await activitiesApi.deleteDocumentComment(aid, previewDoc.documentId, commentId);
      setDocComments(prev => prev.filter(c => c.comment_id !== commentId));
      const drop = (list: any[]) => list.map(d => d.document_id === previewDoc.documentId ? { ...d, comment_count: Math.max(0, (d.comment_count ?? 1) - 1) } : d);
      setDocuments(drop);
      setPictures(drop);
    } catch { toast.error('Failed to delete comment'); }
  };

  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<{ doc: any; category: 'document' | 'picture' } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const requestDeleteDocument = (doc: any, category: 'document' | 'picture') => {
    setConfirmDeleteDoc({ doc, category });
  };

  const confirmDeleteDocument = async () => {
    if (!confirmDeleteDoc) return;
    const { doc, category } = confirmDeleteDoc;
    setDeletingDoc(true);
    try {
      await activitiesApi.deleteDocument(aid, doc.document_id);
      if (category === 'picture') {
        setPictures(prev => prev.filter(d => d.document_id !== doc.document_id));
      } else {
        setDocuments(prev => prev.filter(d => d.document_id !== doc.document_id));
      }
      if (previewDoc?.documentId === doc.document_id) setPreviewDoc(null);
      toast.success('Deleted', doc.name);
      setConfirmDeleteDoc(null);
    } catch (err: any) {
      toast.error('Delete failed', err?.response?.data?.message ?? 'Could not delete this file');
    } finally {
      setDeletingDoc(false);
    }
  };

  const canDeleteDoc = (doc: any) => user?.role === 'admin' || user?.role === 'manager' || Number(doc.created_by) === user?.user_id;

  const fmt  = (n?: number | string | null) => (n != null && n !== '') ? `TZS ${Number(n).toLocaleString()}` : '—';
  const dt   = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const effectiveBudget = (a: any) => a?.effective_budget ?? a?.revised_amount ?? a?.budgeted_amount ?? null;
  const isTerminal = activity && (activity.status === 'completed' || activity.status === 'cancelled');
  const allowedNext = activity ? (TRANSITIONS[activity.status] ?? []) : [];


  const fileUrl = (doc: any) => {
    const base = (import.meta.env.VITE_API_URL ?? '').replace('/api', '');
    const filePath = doc.file_path ?? '';
    const filename = filePath.includes('/') ? filePath.split('/').pop() : filePath;
    return `${base}/uploads/${filename}`;
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
      <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  );

  if (!activity) return <div className="text-center py-16 text-gray-400">Activity not found</div>;

  return (
    <div className="space-y-5">
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
          <BackButton to="/activities" />
          {!isTerminal && (user?.role === 'admin' || user?.role === 'manager') && (
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Progress</p>
            <p className="font-bold text-2xl text-brand-600 dark:text-brand-400">{activity.progress}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Budget</p>
            <p className="font-semibold text-gray-800 dark:text-white">
              {fmt(effectiveBudget(activity))}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Paid</p>
            {(activity as any).total_paid > 0 ? (
              <p className="font-semibold text-green-600 dark:text-green-400">{fmt((activity as any).total_paid)}</p>
            ) : (
              <p className="font-medium text-gray-400">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
{(() => {
              const eb  = effectiveBudget(activity);
              if (eb == null) return <p className="font-medium text-gray-400">—</p>;
              const rem = Number(eb) - Number((activity as any).total_paid || 0);
              return <p className={`font-semibold ${rem < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>{fmt(rem)}</p>;
            })()}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Start</p>
            <p className="font-medium text-gray-700 dark:text-gray-300">{dt(activity.start_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">End</p>
            <p className="font-medium text-gray-700 dark:text-gray-300">{dt(activity.end_date)}</p>
          </div>
        </div>
        <BudgetBar value={activity.progress} status={activity.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { key: 'details',   label: 'Details' },
          { key: 'history',   label: `Status History (${history.length})` },
          { key: 'documents', label: `Documents (${documents.length})` },
          { key: 'pictures',  label: `Pictures (${pictures.length})` },
          { key: 'sub',       label: `Sub-Activities (${subActivities.length})` },
          { key: 'comments',  label: `Comments (${comments.length})` },
          { key: 'budget',    label: `Budget (${revisions.length} revisions)` },
          { key: 'payments',  label: `Payments (${payments.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            { label: 'Budgeted',        value: fmt(activity.budgeted_amount ?? (activity as any).budgeted_amount) },
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
              <RichTextDisplay html={activity.description} />
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
              { label: 'Effective Budget', value: fmt(effectiveBudget(activity)) },
            ].map(i => (
              <div key={i.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <p className="text-xs text-gray-400 mb-1">{i.label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{i.value}</p>
              </div>
            ))}
          </div>

          {!isTerminal && (user?.role === 'admin' || user?.role === 'manager') && (
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
              <BudgetBar value={s.progress} status={s.status} />
            </div>
          ))}
        </div>
      )}

      {/* Comments Tab */}
      {tab === 'comments' && (
        <div className="space-y-4">
          {/* Add comment */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <textarea
              rows={3}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                disabled={addingComment || !commentText.trim()}
                onClick={async () => {
                  setAddingComment(true);
                  try {
                    const res = await activitiesApi.addComment(aid, commentText);
                    setComments(prev => [...prev, res.data]);
                    setCommentText('');
                    toast.success('Comment added');
                  } catch (err: any) {
                    toast.error('Failed', err?.response?.data?.message ?? 'Could not add comment');
                  } finally { setAddingComment(false); }
                }}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
              >
                {addingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No comments yet</p>
          ) : (
            <div className="space-y-3">
              {comments.map((cm: any) => (
                <div key={cm.comment_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
                        {cm.user_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2)}
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">{cm.user_name}</span>
                      <span className="text-xs text-gray-400">{new Date(cm.created_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    {(user?.role === 'admin' || Number(cm.user_id) === user?.user_id) && (
                      <button
                        onClick={async () => {
                          try {
                            await activitiesApi.deleteComment(aid, cm.comment_id);
                            setComments(prev => prev.filter((x: any) => x.comment_id !== cm.comment_id));
                          } catch { toast.error('Failed', 'Could not delete comment'); }
                        }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >Delete</button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{cm.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => openUploadModal('document')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Upload Document
            </button>
          </div>

          {documents.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No documents uploaded yet</p>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              {documents.map((doc: any) => (
                <div key={doc.document_id} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <svg className="w-8 h-8 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{doc.name}</p>
                    {doc.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{doc.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{doc.uploaded_by_name} · v{doc.version_number} · {doc.size ? `${(doc.size/1024).toFixed(1)} KB` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openDocPreview(doc, 'document')}
                      className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600"
                    >
                      Preview
                      {doc.comment_count > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-[10px] font-medium">
                          {doc.comment_count}
                        </span>
                      )}
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <a href={fileUrl(doc)} download={doc.name}
                      className="text-xs text-gray-500 hover:text-brand-600">
                      Download
                    </a>
                    {canDeleteDoc(doc) && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <button
                          onClick={() => requestDeleteDocument(doc, 'document')}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PICTURES TAB ── */}
      {tab === 'pictures' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => openUploadModal('picture')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Upload Picture
            </button>
          </div>

          {pictures.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No pictures uploaded yet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {pictures.map((pic: any) => (
                <div
                  key={pic.document_id}
                  className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 aspect-square"
                >
                  <button onClick={() => openDocPreview(pic, 'picture')} className="block w-full h-full text-left">
                    <img
                      src={fileUrl(pic)}
                      alt={pic.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 pt-6">
                      <p className="text-xs font-medium text-white truncate">{pic.name}</p>
                    </div>
                  </button>
                  {pic.comment_count > 0 && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium pointer-events-none">
                      {pic.comment_count} 💬
                    </span>
                  )}
                  {canDeleteDoc(pic) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); requestDeleteDocument(pic, 'picture'); }}
                      className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                      title="Delete picture"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === 'payments' && (
        <div className="space-y-4">

          {/* Budget summary bar */}
          {paySummary && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Budget', value: paySummary.effective_budget ?? effectiveBudget(activity), color: 'text-gray-800 dark:text-white' },
                  { label: 'Paid',   value: paySummary.total_paid,       color: 'text-green-600 dark:text-green-400' },
                  { label: 'Pending',value: paySummary.pending_amount,   color: 'text-orange-600 dark:text-orange-400' },
                  { label: 'Available',value: paySummary.available,      color: paySummary.available < 0 ? 'text-red-600 dark:text-red-400' : 'text-brand-600 dark:text-brand-400' },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-xs text-gray-400 mb-0.5">{m.label}</p>
                    <p className={`text-sm font-semibold ${m.color}`}>TZS {Number(m.value).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(paySummary.utilization_pct, 100)}%`,
                    background: paySummary.utilization_pct >= 100 ? '#E24B4A' : paySummary.utilization_pct >= 80 ? '#BA7517' : '#1D9E75',
                  }} />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">{paySummary.utilization_pct}% utilised</p>
            </div>
          )}

          {/* Record payment button (PM/admin) */}
          {(user?.role === 'admin' || user?.role === 'manager') && !showPayForm && (
            <div className="flex justify-end">
              <button onClick={() => setShowPayForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Record Payment
              </button>
            </div>
          )}

          {/* Payment form */}
          {showPayForm && (
            <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Record New Payment</h3>
                <button onClick={() => setShowPayForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Amount (TZS)', key: 'amount', type: 'number', required: true, placeholder: '500000' },
                  { label: 'Payment Date', key: 'payment_date', type: 'date', required: true },
                  { label: 'Payee', key: 'payee', placeholder: 'Contractor / Supplier name' },
                  { label: 'Payment Method', key: 'payment_method', placeholder: 'Bank Transfer, Cheque...' },
                  { label: 'Reference / Cheque No', key: 'reference_no', placeholder: 'TXN-001' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input type={f.type ?? 'text'} value={(payForm as any)[f.key]}
                      onChange={e => setPayForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
                  <select value={payForm.status} onChange={e => setPayForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400">
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Description</label>
                <textarea rows={2} value={payForm.description}
                  onChange={e => setPayForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Payment details..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Evidence / Receipt (optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    Attach file
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => setPayFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {payFile && <span className="text-xs text-brand-500 truncate max-w-[160px]">{payFile.name}</span>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowPayForm(false)} type="button"
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
                <button type="button" disabled={savingPay}
                  onClick={async () => {
                    if (!payForm.amount || !payForm.payment_date) return;
                    setSavingPay(true);
                    try {
                      const fd = new FormData();
                      // Append fields explicitly — amount must be a clean number string
                      fd.append('amount',         String(parseFloat(payForm.amount)));
                      fd.append('payment_date',   payForm.payment_date);
                      fd.append('status',         payForm.status);
                      if (payForm.payment_method) fd.append('payment_method', payForm.payment_method);
                      if (payForm.reference_no)   fd.append('reference_no',   payForm.reference_no);
                      if (payForm.payee)           fd.append('payee',          payForm.payee);
                      if (payForm.description)     fd.append('description',    payForm.description);
                      if (payFile) fd.append('evidence', payFile);
                      const res = await activitiesApi.createPayment(aid, fd);
                      setPayments(prev => [res.data, ...prev]);
                      // Refresh summary
                      const s = await activitiesApi.getPaymentSummary(aid);
                      setPaySummary(s.data);
                      setShowPayForm(false);
                      setPayForm({ amount: '', payment_date: new Date().toISOString().slice(0,10), payment_method: '', reference_no: '', payee: '', description: '', status: 'pending' });
                      setPayFile(null);
                      toast.success('Payment recorded');
                    } catch (err: any) {
                      toast.error('Failed', err?.response?.data?.message ?? 'Could not record payment');
                    } finally { setSavingPay(false); }
                  }}
                  className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
                  {savingPay ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          )}

          {/* Payments list */}
          {payments.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-400">No payments recorded yet</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.payment_id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-gray-800 dark:text-white">
                          TZS {Number(p.amount).toLocaleString()}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          p.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                          : p.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                        }`}>{p.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(p.payment_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                        {p.payee && ` · ${p.payee}`}
                        {p.payment_method && ` · ${p.payment_method}`}
                        {p.reference_no && ` · Ref: ${p.reference_no}`}
                      </p>
                      {p.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">By {p.created_by_name}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Evidence preview */}
                      {p.evidence_path && (
                        <button
                          onClick={() => {
                            const base = (import.meta.env.VITE_API_URL ?? '').replace('/api', '');
                            const filename = p.evidence_path.split('/').pop();
                            setPreviewDoc({ url: `${base}/uploads/${filename}`, name: p.evidence_name ?? filename });
                          }}
                          className="px-2.5 py-1 text-xs text-brand-500 hover:text-brand-600 border border-brand-200 dark:border-brand-500/30 rounded-md"
                        >Receipt</button>
                      )}
                      {/* Approve/Reject (PM/admin only) */}
                      {(user?.role === 'admin' || user?.role === 'manager') && p.status === 'pending' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                const res = await activitiesApi.updatePaymentStatus(aid, p.payment_id, 'approved');
                                setPayments(prev => prev.map(x => x.payment_id === p.payment_id ? res.data : x));
                                const s = await activitiesApi.getPaymentSummary(aid);
                                setPaySummary(s.data);
                                toast.success('Payment approved');
                              } catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
                            }}
                            className="px-2.5 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-md"
                          >Approve</button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await activitiesApi.updatePaymentStatus(aid, p.payment_id, 'rejected');
                                setPayments(prev => prev.map(x => x.payment_id === p.payment_id ? res.data : x));
                                toast.success('Payment rejected');
                              } catch { toast.error('Failed', 'Could not reject'); }
                            }}
                            className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md"
                          >Reject</button>
                        </>
                      )}
                      {/* Delete (non-approved only) */}
                      {p.status !== 'approved' && (user?.role === 'admin' || Number(p.created_by) === user?.user_id) && (
                        <button
                          onClick={async () => {
                            try {
                              await activitiesApi.deletePayment(aid, p.payment_id);
                              setPayments(prev => prev.filter(x => x.payment_id !== p.payment_id));
                              const s = await activitiesApi.getPaymentSummary(aid);
                              setPaySummary(s.data);
                            } catch { toast.error('Failed', 'Could not delete'); }
                          }}
                          className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md"
                        >Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File Preview Modal */}
      {previewDoc && (
        <FilePreview
          url={previewDoc.url}
          name={previewDoc.name}
          mimeType={previewDoc.mime}
          description={previewDoc.description}
          comments={previewDoc.documentId ? docComments : undefined}
          onAddComment={previewDoc.documentId ? handleAddDocComment : undefined}
          onDeleteComment={previewDoc.documentId ? handleDeleteDocComment : undefined}
          canDeleteComment={(c) => user?.role === 'admin' || Number(c.created_by) === user?.user_id}
          onDelete={previewDoc.doc && canDeleteDoc(previewDoc.doc) ? () => requestDeleteDocument(previewDoc.doc, previewDoc.category ?? 'document') : undefined}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Upload Document / Picture Modal */}
      <Modal isOpen={!!uploadModal} onClose={() => setUploadModal(null)} title={uploadModal === 'picture' ? 'Upload Picture' : 'Upload Document'} size="xl">
        <form onSubmit={handleUpload} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              {uploadModal === 'picture' ? 'Picture' : 'File'} <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept={uploadModal === 'picture' ? 'image/*' : undefined}
              onChange={e => setUploadForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-brand-500 file:text-white file:text-sm hover:file:bg-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              {uploadModal === 'picture' ? 'Picture Name' : 'Document Name'}
            </label>
            <input
              type="text"
              value={uploadForm.name}
              onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))}
              placeholder={uploadForm.file?.name || 'Leave blank to use file name'}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
          <FormTextArea
            label="Description"
            rows={8}
            value={uploadForm.description}
            onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
            placeholder={uploadModal === 'picture' ? 'What does this picture show?' : 'What is this document about?'}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setUploadModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
            <button type="submit" disabled={uploading} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </form>
      </Modal>

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
            Current effective budget: <strong className="text-gray-700 dark:text-gray-300">{fmt(effectiveBudget(activity))}</strong>
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

      {/* Delete Document/Picture Confirmation */}
      <Modal isOpen={!!confirmDeleteDoc} onClose={() => setConfirmDeleteDoc(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4 text-center -mt-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h4 className="text-base font-semibold text-gray-800 dark:text-white">
              Delete this {confirmDeleteDoc?.category === 'picture' ? 'picture' : 'document'}?
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              <span className="font-medium text-gray-700 dark:text-gray-300">"{confirmDeleteDoc?.doc?.name}"</span> will be permanently removed, along with its comments. This cannot be undone.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-1">
            <button
              onClick={() => setConfirmDeleteDoc(null)}
              disabled={deletingDoc}
              className="px-5 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteDocument}
              disabled={deletingDoc}
              className="px-5 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {deletingDoc ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
