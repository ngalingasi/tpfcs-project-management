import { useCallback, useEffect, useMemo, useState } from 'react';
import { guestsApi, projectsApi, usersApi } from '../../api';
import type { GuestRecord, Project } from '../../types';
import Modal from '../../components/tpfcs/Modal';
import CredentialsDialog from '../../components/tpfcs/CredentialsDialog';
import { FormInput } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import PopupDateInput from '../../components/tpfcs/PopupDateInput';

const todayStr = () => new Date().toISOString().slice(0, 10);
const isExpired = (g: GuestRecord) => !!g.guest_expires_at && g.guest_expires_at < todayStr();

function ProjectPicker({ projects, selected, onChange }: { projects: Project[]; selected: number[]; onChange: (ids: number[]) => void }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => projects.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [projects, q]);
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Projects this guest can see <span className="text-red-500">*</span>
          <span className="font-normal text-gray-400"> ({selected.length} selected)</span>
        </label>
        <div className="flex gap-3 text-xs">
          <button type="button" className="text-brand-500" onClick={() => onChange(projects.map(p => p.project_id))}>All</button>
          <button type="button" className="text-gray-400" onClick={() => onChange([])}>None</button>
        </div>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects…"
        className="w-full mb-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:border-brand-400" />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
        {shown.length === 0 && <p className="p-3 text-sm text-gray-400">No projects found</p>}
        {shown.map(p => (
          <label key={p.project_id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <input type="checkbox" checked={selected.includes(p.project_id)} onChange={() => toggle(p.project_id)} />
            <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface FormProps {
  guest?: GuestRecord;
  projects: Project[];
  onClose: () => void;
  onSaved: (created?: GuestRecord) => void;
}

function GuestForm({ guest, projects, onClose, onSaved }: FormProps) {
  const isEdit = !!guest;
  const [form, setForm] = useState({
    full_name: guest?.full_name ?? '',
    username: guest?.username ?? '',
    organisation: guest?.organisation ?? '',
    email: guest?.email ?? '',
    mobile: guest?.mobile ?? '',
    password: '',
    guest_expires_at: guest?.guest_expires_at ?? '',
    status: guest?.status ?? 'active',
  });
  const [ids, setIds] = useState<number[]>(guest?.projects.map(p => p.project_id) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || (!isEdit && !form.username.trim())) { setError('Full name and username are required'); return; }
    if (ids.length === 0) { setError('Choose at least one project'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await guestsApi.update(guest!.user_id, {
          full_name: form.full_name.trim(), organisation: form.organisation.trim(), email: form.email.trim(),
          mobile: form.mobile.trim(), guest_expires_at: form.guest_expires_at || null, status: form.status as 'active' | 'inactive',
          project_ids: ids,
        });
        toast.success('Guest updated');
        onSaved();
      } else {
        const res = await guestsApi.create({
          full_name: form.full_name.trim(), username: form.username.trim(), organisation: form.organisation.trim() || undefined,
          email: form.email.trim() || undefined, mobile: form.mobile.trim() || undefined,
          ...(form.password.trim() ? { password: form.password } : {}),
          guest_expires_at: form.guest_expires_at || null, project_ids: ids,
        });
        toast.success('Guest created');
        onSaved(res.data);
      }
      onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed to save guest';
      setError(m); toast.error('Save failed', m);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput label="Full Name" required value={form.full_name} onChange={e => set('full_name', e.target.value)} />
        <FormInput label="Organisation" value={form.organisation} onChange={e => set('organisation', e.target.value)} placeholder="e.g. Donor / Client / Auditor" />
        <FormInput label="Username" required value={form.username} onChange={e => set('username', e.target.value)} disabled={isEdit} placeholder="letters and numbers" />
        <FormInput label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        <FormInput label="Mobile" value={form.mobile} onChange={e => set('mobile', e.target.value)} />
        <PopupDateInput id="guest-expires" label="Access ends on (optional)" placeholder="No end date" minDate={form.guest_expires_at && form.guest_expires_at < todayStr() ? undefined : todayStr()} clearable
          value={form.guest_expires_at} onChange={v => set('guest_expires_at', v)} />
      </div>
      {!isEdit && (
        <FormInput label="Password" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Leave blank to use the default password" />
      )}
      {isEdit && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm">
            <option value="active">Active</option>
            <option value="inactive">Inactive (cannot sign in)</option>
          </select>
        </div>
      )}
      <ProjectPicker projects={projects} selected={ids} onChange={setIds} />
      <p className="text-xs text-gray-500">Guests can view the chosen projects, their plan, activities and documents, and add comments. They cannot change anything and never see budgets or payments.</p>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving…' : isEdit ? 'Update Guest' : 'Create Guest'}
        </button>
      </div>
    </form>
  );
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'reset' | null>(null);
  const [selected, setSelected] = useState<GuestRecord | null>(null);
  const [creds, setCreds] = useState<{ title: string; username: string; password: string; note?: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, p] = await Promise.all([guestsApi.list(), projectsApi.list({ page: 1, limit: 100 })]);
      setGuests(g.data);
      setProjects(p.data.results);
    } catch { toast.error('Could not load guests'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = guests.filter(g => `${g.full_name} ${g.username} ${g.organisation ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const doReset = async () => {
    if (!selected) return;
    setResetting(true);
    try {
      const res = await usersApi.resetPassword(selected.user_id);
      setModal(null);
      setCreds({ title: 'Password reset', username: selected.username, password: res.data.password,
        note: res.data.is_default ? 'This is the default password.' : 'No default password is configured, so a random one was generated.' });
    } catch (err: any) { toast.error('Reset failed', err?.response?.data?.message); }
    finally { setResetting(false); }
  };

  const toggleActive = async (g: GuestRecord) => {
    try {
      await guestsApi.update(g.user_id, { status: g.status === 'active' ? 'inactive' : 'active' });
      toast.success(g.status === 'active' ? 'Guest deactivated' : 'Guest activated');
      load();
    } catch (err: any) { toast.error('Update failed', err?.response?.data?.message); }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">Guests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">External people with read-only access to chosen projects.</p>
        </div>
        <button onClick={() => { setSelected(null); setModal('create'); }} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">+ Add Guest</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests…"
        className="w-full sm:w-72 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:border-brand-400" />

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Projects</th>
              <th className="px-4 py-3 font-medium">Access ends</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No guests yet</td></tr>}
            {rows.map(g => (
              <tr key={g.user_id} className="border-b border-gray-50 dark:border-gray-800/60 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 dark:text-white">{g.full_name}</p>
                  <p className="text-xs text-gray-500">{g.username}{g.organisation ? ` · ${g.organisation}` : ''}</p>
                  {g.email && <p className="text-xs text-gray-400">{g.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5 max-w-xs">
                    {g.projects.length === 0 && <span className="text-xs text-gray-400">None</span>}
                    {g.projects.map(p => <span key={p.project_id} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{p.name}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {g.guest_expires_at ? (
                    <span className={isExpired(g) ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}>
                      {new Date(g.guest_expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {isExpired(g) && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Expired</span>}
                    </span>
                  ) : <span className="text-gray-400">No end date</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${g.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>{g.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                    <button onClick={() => { setSelected(g); setModal('edit'); }} className="px-2.5 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">Edit</button>
                    <button onClick={() => { setSelected(g); setModal('reset'); }} className="px-2.5 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-md">Reset PW</button>
                    <button onClick={() => toggleActive(g)} className={`px-2.5 py-1 text-xs rounded-md ${g.status === 'active' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10'}`}>
                      {g.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Add Guest" size="lg">
        <GuestForm projects={projects} onClose={() => setModal(null)}
          onSaved={(created) => { load(); if (created?.temporary_password) setCreds({ title: 'Guest created', username: created.username, password: created.temporary_password, note: 'The guest signs in with these details and must choose a new password.' }); }} />
      </Modal>
      <Modal isOpen={modal === 'edit' && !!selected} onClose={() => setModal(null)} title="Edit Guest" size="lg">
        {selected && <GuestForm guest={selected} projects={projects} onClose={() => setModal(null)} onSaved={load} />}
      </Modal>
      <Modal isOpen={modal === 'reset' && !!selected} onClose={() => setModal(null)} title="Reset password" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Set a new temporary password for <strong>{selected?.full_name}</strong>? They will be signed out and must choose a new password at next login.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg">Cancel</button>
          <button onClick={doReset} disabled={resetting} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">{resetting ? 'Resetting…' : 'Reset Password'}</button>
        </div>
      </Modal>
      <CredentialsDialog open={!!creds} onClose={() => setCreds(null)} title={creds?.title ?? ''} username={creds?.username} password={creds?.password ?? ''} note={creds?.note} />
    </div>
  );
}
