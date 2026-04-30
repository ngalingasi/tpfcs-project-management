import { useEffect, useState, useCallback } from 'react';
import { usersApi } from '../../api';
import type { UserRecord } from '../../types';
import Modal from '../../components/tpfcs/Modal';
import { FormInput, FormSelect } from '../../components/tpfcs/FormField';
import { useAuth } from '../../store/authStore';

// ── User Form ─────────────────────────────────────────────────────────────────
interface UserFormProps {
  initial?: Partial<UserRecord>;
  onSaved: () => void;
  onClose: () => void;
}

function UserForm({ initial, onSaved, onClose }: UserFormProps) {
  const isEdit = !!initial?.user_id;
  const [form, setForm] = useState({
    full_name:  initial?.full_name  ?? '',
    username:   initial?.username   ?? '',
    email:      initial?.email      ?? '',
    mobile:     initial?.mobile     ?? '',
    gender:     initial?.gender     ?? 'male',
    role:       initial?.role       ?? 'user',
    status:     initial?.status     ?? 'active',
    password:   '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    if (!form.username.trim())  { setError('Username is required');  return; }
    if (!isEdit && !form.password.trim()) { setError('Password is required for new users'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        const { password, ...rest } = form;
        await usersApi.update(initial!.user_id!, rest);
      } else {
        await usersApi.create(form);
      }
      onSaved(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-500/20">{error}</p>}
      <FormInput label="Full Name" required value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. John Mwangi" />
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Username" required value={form.username} onChange={e => set('username', e.target.value)} placeholder="johndoe" disabled={isEdit} />
        <FormInput label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@tpfcs.go.tz" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Mobile" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+255712345678" />
        <FormSelect label="Gender" value={form.gender} onChange={e => set('gender', e.target.value)}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </FormSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormSelect label="Role" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </FormSelect>
        <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </FormSelect>
      </div>
      {!isEdit && (
        <FormInput label="Password" required type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Temporary password" />
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}</button>
      </div>
    </form>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cls =
    role === 'admin'   ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
    role === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                         'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{role}</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me } = useAuth();
  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal,    setModal]    = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, limit: 12, search: search || undefined, role: roleFilter || undefined });
      setUsers(res.data.results);
      setTotal(res.data.totalResults);
    } finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const openEdit   = (u: UserRecord) => { setSelected(u); setModal('edit'); };
  const openDelete = (u: UserRecord) => { setSelected(u); setError(''); setModal('delete'); };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true); setError('');
    try {
      await usersApi.delete(selected.user_id);
      await load(); setModal(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to deactivate user');
    } finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} total users</p>
        </div>
        <button onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input type="text" placeholder="Search by name, username or email..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="w-full sm:w-36 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {['User', 'Username', 'Contact', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                          {u.full_name.split(' ').map(n => n[0]).slice(0,2).join('')}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800 dark:text-white">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">@{u.username}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-600 dark:text-gray-400">{u.email ?? '—'}</div>
                    {u.mobile && <div className="text-xs text-gray-400">{u.mobile}</div>}
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      u.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)}
                        className="px-3 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg">Edit</button>
                      {me?.user_id !== u.user_id && (
                        <button onClick={() => openDelete(u)}
                          className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages} · {total} users</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? `Edit — ${selected?.full_name}` : 'Create New User'} size="md">
        <UserForm initial={modal === 'edit' ? selected ?? undefined : undefined} onSaved={load} onClose={() => setModal(null)} />
      </Modal>

      {/* Delete/Deactivate Modal */}
      <Modal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="Deactivate User" size="sm">
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to {selected?.status === 'active' ? 'deactivate' : 'activate'}{' '}
          <strong className="text-gray-800 dark:text-white">{selected?.full_name}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
            {deleting ? 'Processing...' : selected?.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
