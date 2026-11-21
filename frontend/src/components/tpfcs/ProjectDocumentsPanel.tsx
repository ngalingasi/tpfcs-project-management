import { useCallback, useEffect, useMemo, useState } from 'react';
import { documentsApi } from '../../api';
import type { ProjectSite } from '../../types';
import { useAuth } from '../../store/authStore';
import { toast } from './Toast';
import Modal from './Modal';
import FilePreview from './FilePreview';
import { fileUrl } from '../../utils/fileUrl';

interface Props {
  projectId: number;
  projectManagerId?: number | null;
  sites: ProjectSite[];
}

type Cat = 'document' | 'picture';
const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400';
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5';

export default function ProjectDocumentsPanel({ projectId, projectManagerId, sites }: Props) {
  const { user } = useAuth();
  // Mirrors the server rule: admin or this project's own project manager.
  const canManage = user?.role === 'admin' || (projectManagerId != null && Number(projectManagerId) === Number(user?.user_id));

  const [cat, setCat] = useState<Cat>('document');
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', site_id: '', sort_order: '0', file: null as File | null });
  const [saving, setSaving] = useState(false);

  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', site_id: '' });

  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [versionDoc, setVersionDoc] = useState<any | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocs((await documentsApi.listByProject(projectId)).data); }
    catch { toast.error('Could not load documents'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(
    () => docs.filter(d => d.category === cat && (!siteFilter || String(d.site_id) === siteFilter))
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || b.document_id - a.document_id),
    [docs, cat, siteFilter]
  );
  const count = (c: Cat) => docs.filter(d => d.category === c).length;

  const patch = (id: number, p: any) => setDocs(prev => prev.map(d => d.document_id === id ? { ...d, ...p } : d));

  const openUpload = () => {
    setForm({ name: '', description: '', site_id: siteFilter, sort_order: '0', file: null });
    setUploadOpen(true);
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file) { toast.error('File required', 'Please choose a file to upload'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      if (form.name.trim()) fd.append('name', form.name.trim());
      if (form.description.trim()) fd.append('description', form.description.trim());
      if (form.site_id) fd.append('site_id', form.site_id);
      fd.append('category', cat);
      fd.append('sort_order', form.sort_order || '0');
      const res = await documentsApi.upload(projectId, fd);
      setDocs(prev => [res.data, ...prev]);
      toast.success(cat === 'picture' ? 'Picture uploaded' : 'Document uploaded', res.data.name);
      setUploadOpen(false);
    } catch (err: any) {
      toast.error('Upload failed', err?.response?.data?.message ?? 'Could not upload file');
    } finally { setSaving(false); }
  };

  const openEdit = (d: any) => {
    setEditDoc(d);
    setEditForm({ name: d.name ?? '', description: d.description ?? '', site_id: d.site_id ? String(d.site_id) : '' });
  };
  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc) return;
    if (!editForm.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      const res = await documentsApi.update(editDoc.document_id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        site_id: editForm.site_id ? Number(editForm.site_id) : null,
      });
      patch(editDoc.document_id, res.data);
      toast.success('Details updated');
      setEditDoc(null);
    } catch (err: any) {
      toast.error('Update failed', err?.response?.data?.message);
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setSaving(true);
    try {
      await documentsApi.remove(confirmDel.document_id);
      setDocs(prev => prev.filter(d => d.document_id !== confirmDel.document_id));
      if (preview?.document_id === confirmDel.document_id) setPreview(null);
      toast.success('Deleted', confirmDel.name);
      setConfirmDel(null);
    } catch (err: any) {
      toast.error('Delete failed', err?.response?.data?.message);
    } finally { setSaving(false); }
  };

  const submitVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionDoc || !versionFile) { toast.error('File required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', versionFile);
      const res = await documentsApi.uploadVersion(versionDoc.document_id, fd);
      patch(versionDoc.document_id, res.data);
      toast.success('New version uploaded', `v${res.data.version_number}`);
      setVersionDoc(null); setVersionFile(null);
    } catch (err: any) {
      toast.error('Upload failed', err?.response?.data?.message);
    } finally { setSaving(false); }
  };

  const openPreview = async (d: any) => {
    setPreview(d); setComments([]);
    try { setComments((await documentsApi.comments(d.document_id)).data); } catch { /* ignore */ }
  };
  const addComment = async (text: string) => {
    if (!preview) return;
    try {
      const res = await documentsApi.addComment(preview.document_id, text);
      setComments(prev => [...prev, res.data]);
      patch(preview.document_id, { comment_count: (preview.comment_count ?? 0) + 1 });
      setPreview((p: any) => p && { ...p, comment_count: (p.comment_count ?? 0) + 1 });
    } catch (err: any) { toast.error('Failed to add comment', err?.response?.data?.message); }
  };
  const deleteComment = async (commentId: number) => {
    if (!preview) return;
    try {
      await documentsApi.deleteComment(preview.document_id, commentId);
      setComments(prev => prev.filter(c => c.comment_id !== commentId));
      patch(preview.document_id, { comment_count: Math.max(0, (preview.comment_count ?? 1) - 1) });
      setPreview((p: any) => p && { ...p, comment_count: Math.max(0, (p.comment_count ?? 1) - 1) });
    } catch (err: any) { toast.error('Failed to delete comment', err?.response?.data?.message); }
  };

  const SiteSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      <option value="">Not tied to a specific site</option>
      {sites.map(s => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        {(['document', 'picture'] as Cat[]).map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${cat === c ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {c === 'document' ? 'Documents' : 'Pictures'}
            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">{count(c)}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {sites.length > 0 ? (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Site:</label>
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-brand-400">
              <option value="">All sites</option>
              {sites.map(s => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
            </select>
          </div>
        ) : <span />}
        {canManage && (
          <button onClick={openUpload} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {cat === 'picture' ? 'Upload Picture' : 'Upload Document'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center py-8 text-sm text-gray-400">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-center py-8 text-sm text-gray-400">
          {count(cat) === 0 ? `No project ${cat === 'picture' ? 'pictures' : 'documents'} yet` : 'Nothing matches this site'}
        </p>
      ) : cat === 'document' ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          {list.map(d => (
            <div key={d.document_id} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <svg className="w-8 h-8 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{d.name}</p>
                {d.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{d.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{d.uploaded_by_name} · v{d.version_number} · {d.size ? `${(d.size / 1024).toFixed(1)} KB` : ''}{d.site_name && ` · Site: ${d.site_name}`}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                <button onClick={() => openPreview(d)} className="text-brand-500 hover:text-brand-600">
                  Preview{d.comment_count > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-[10px] font-medium">{d.comment_count}</span>}
                </button>
                <a href={fileUrl(d)} download={d.name} className="text-gray-500 hover:text-brand-600">Download</a>
                {canManage && (
                  <>
                    <button onClick={() => openEdit(d)} className="text-gray-500 hover:text-brand-600">Edit</button>
                    <button onClick={() => { setVersionDoc(d); setVersionFile(null); }} className="text-gray-500 hover:text-brand-600">New version</button>
                    <button onClick={() => setConfirmDel(d)} className="text-gray-400 hover:text-red-500">Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map(p => (
            <div key={p.document_id} className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 aspect-square">
              <button onClick={() => openPreview(p)} className="block w-full h-full text-left">
                <img src={fileUrl(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 pt-6">
                  <p className="text-xs font-medium text-white truncate">{p.name}</p>
                  {p.site_name && <p className="text-[10px] text-white/70 truncate">Site: {p.site_name}</p>}
                </div>
              </button>
              {p.comment_count > 0 && <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium pointer-events-none">{p.comment_count} 💬</span>}
              {canManage && (
                <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)} title="Edit details" className="px-2 h-7 rounded-full bg-black/60 text-white text-[11px] hover:bg-brand-600">Edit</button>
                  <button onClick={() => setConfirmDel(p)} title="Delete picture" className="px-2 h-7 rounded-full bg-black/60 text-white text-[11px] hover:bg-red-600">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title={cat === 'picture' ? 'Upload Picture' : 'Upload Document'} size="xl">
        <form onSubmit={submitUpload} className="space-y-5">
          <div>
            <label className={labelCls}>{cat === 'picture' ? 'Picture' : 'File'} <span className="text-red-500">*</span></label>
            <input type="file" accept={cat === 'picture' ? 'image/*' : undefined}
              onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-brand-500 file:text-white file:text-sm hover:file:bg-brand-600" />
          </div>
          <div>
            <label className={labelCls}>{cat === 'picture' ? 'Picture Name' : 'Document Name'}</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={form.file?.name || 'Leave blank to use file name'} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
          </div>
          {sites.length > 0 && (
            <div><label className={labelCls}>Site (optional)</label><SiteSelect value={form.site_id} onChange={v => setForm(f => ({ ...f, site_id: v }))} /></div>
          )}
          <div>
            <label className={labelCls}>Sort Order</label>
            <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className={inputCls} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setUploadOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Uploading…' : 'Upload'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit details */}
      <Modal isOpen={!!editDoc} onClose={() => setEditDoc(null)} title="Edit details" size="lg">
        <form onSubmit={submitEdit} className="space-y-5">
          <div><label className={labelCls}>Name <span className="text-red-500">*</span></label>
            <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Description</label>
            <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
          {sites.length > 0 && <div><label className={labelCls}>Site</label><SiteSelect value={editForm.site_id} onChange={v => setEditForm(f => ({ ...f, site_id: v }))} /></div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditDoc(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">Save</button>
          </div>
        </form>
      </Modal>

      {/* New version */}
      <Modal isOpen={!!versionDoc} onClose={() => setVersionDoc(null)} title={`New version of “${versionDoc?.name ?? ''}”`} size="md">
        <form onSubmit={submitVersion} className="space-y-5">
          <input type="file" onChange={e => setVersionFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-brand-500 file:text-white file:text-sm" />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setVersionDoc(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">Upload</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete file?" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">“{confirmDel?.name}” and all its versions and comments will be permanently removed.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Cancel</button>
          <button onClick={doDelete} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Delete</button>
        </div>
      </Modal>

      {preview && (
        <FilePreview
          url={fileUrl(preview)}
          name={preview.name}
          mimeType={preview.mime_type}
          description={preview.description}
          comments={comments}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
          canDeleteComment={(c) => canManage || Number(c.created_by) === Number(user?.user_id)}
          onDelete={canManage ? () => setConfirmDel(preview) : undefined}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
