import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import { activitiesApi, targetsApi, objectivesApi, projectsApi, lookupsApi, usersApi } from '../../api';
import type { Target, Region, UserRecord, Project } from '../../types';
import { FormInput, FormSelect, FormTextArea } from '../../components/tpfcs/FormField';

export default function ActivityForm() {
  const { id }             = useParams<{ id: string }>();
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();
  const isEdit             = !!id;

  const [form, setForm] = useState({
    target_id:        searchParams.get('target_id') ?? '',
    region_id:        '',
    name:             '',
    description:      '',
    council:          '',
    ward:             '',
    street:           '',
    road_name:        '',
    latitude:         '',
    longitude:        '',
    global_id:        '',
    assigned_user_id: '',
    supervisor_id:    '',
    start_date:       '',
    end_date:         '',
    budgeted_amount:  '',
    status:           'pending',
  });

  const [targets,    setTargets]    = useState<Target[]>([]);
  const [regions,    setRegions]    = useState<Region[]>([]);
  const [users,      setUsers]      = useState<UserRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Load dropdowns
        const [rRes, uRes] = await Promise.all([
          lookupsApi.regions(),
          usersApi.list({ limit: 200, status: 'active' }),
        ]);
        setRegions(rRes.data);
        setUsers(uRes.data.results);

        // Load targets from all projects
        const pRes = await projectsApi.list({ limit: 100 });
        const allTargets: Target[] = [];
        for (const project of pRes.data.results) {
          const oRes = await objectivesApi.listByProject(project.project_id);
          for (const obj of oRes.data) {
            const tRes = await targetsApi.listByObjective(obj.objective_id);
            allTargets.push(...tRes.data.map(t => ({ ...t, name: `${project.name} → ${obj.title} → ${t.name}` })));
          }
        }
        setTargets(allTargets);

        // If editing, load existing activity
        if (isEdit) {
          const aRes = await activitiesApi.get(Number(id));
          const a = aRes.data;
          setForm({
            target_id:        a.target_id?.toString() ?? '',
            region_id:        a.region_id?.toString() ?? '',
            name:             a.name ?? '',
            description:      a.description ?? '',
            council:          a.council ?? '',
            ward:             a.ward ?? '',
            street:           a.street ?? '',
            road_name:        a.road_name ?? '',
            latitude:         a.latitude?.toString() ?? '',
            longitude:        a.longitude?.toString() ?? '',
            global_id:        a.global_id ?? '',
            assigned_user_id: a.assigned_user_id?.toString() ?? '',
            supervisor_id:    a.supervisor_id?.toString() ?? '',
            start_date:       a.start_date?.slice(0, 10) ?? '',
            end_date:         a.end_date?.slice(0, 10) ?? '',
            budgeted_amount:  a.budgeted_amount?.toString() ?? '',
            status:           a.status ?? 'pending',
          });
        }
      } finally { setLoading(false); }
    };
    init();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.target_id) { setError('Activity name and target are required'); return; }
    if (!isEdit && !form.budgeted_amount) { setError('Budgeted amount is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        target_id:        form.target_id        ? Number(form.target_id)        : undefined,
        region_id:        form.region_id        ? Number(form.region_id)        : null,
        assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
        supervisor_id:    form.supervisor_id    ? Number(form.supervisor_id)    : null,
        budgeted_amount:  form.budgeted_amount  ? Number(form.budgeted_amount)  : undefined,
        latitude:         form.latitude         ? Number(form.latitude)         : null,
        longitude:        form.longitude        ? Number(form.longitude)        : null,
      };
      if (isEdit) {
        await activitiesApi.update(Number(id), payload);
        navigate(`/activities/${id}`);
      } else {
        const res = await activitiesApi.create(payload);
        navigate(`/activities/${res.data.activity_id}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save activity');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="animate-pulse space-y-4 max-w-3xl mx-auto">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-5">
        <Link to="/activities" className="hover:text-brand-500">Activities</Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300">{isEdit ? 'Edit Activity' : 'New Activity'}</span>
      </div>

      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        {isEdit ? 'Edit Activity' : 'Create New Activity'}
      </h1>

      {error && <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-500/20">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Core */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Activity Details</h2>
          <FormSelect label="Target" required value={form.target_id} onChange={e => set('target_id', e.target.value)}>
            <option value="">Select target...</option>
            {targets.map(t => <option key={t.target_id} value={t.target_id}>{t.name}</option>)}
          </FormSelect>
          <FormInput label="Activity Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Construct borehole at Mwanakwerekwe" />
          <FormTextArea label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe this activity..." />
        </div>

        {/* Location */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Region" value={form.region_id} onChange={e => set('region_id', e.target.value)}>
              <option value="">Select region...</option>
              {regions.map(r => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
            </FormSelect>
            <FormInput label="Council" value={form.council} onChange={e => set('council', e.target.value)} placeholder="Council name" />
            <FormInput label="Ward" value={form.ward} onChange={e => set('ward', e.target.value)} placeholder="Ward name" />
            <FormInput label="Street" value={form.street} onChange={e => set('street', e.target.value)} placeholder="Street name" />
            <FormInput label="Road" value={form.road_name} onChange={e => set('road_name', e.target.value)} placeholder="Road name" />
            <FormInput label="Global ID" value={form.global_id} onChange={e => set('global_id', e.target.value)} placeholder="GIS global ID" />
            <FormInput label="Latitude" type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="-6.1659" />
            <FormInput label="Longitude" type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="39.2026" />
          </div>
        </div>

        {/* Assignment */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assignment & Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Assigned To" value={form.assigned_user_id} onChange={e => set('assigned_user_id', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </FormSelect>
            <FormSelect label="Supervisor" value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)}>
              <option value="">None</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </FormSelect>
            <FormInput label="Start Date" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            <FormInput label="End Date" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>

        {/* Budget & Status */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Budget & Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label={isEdit ? "Budgeted Amount (TZS) — read only after creation" : "Budgeted Amount (TZS)"}
              required={!isEdit}
              type="number"
              value={form.budgeted_amount}
              onChange={e => set('budgeted_amount', e.target.value)}
              placeholder="500000"
              disabled={isEdit}
              className={isEdit ? 'opacity-60 cursor-not-allowed' : ''}
            />
            <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              {isEdit && <option value="completed">Completed</option>}
              {isEdit && <option value="cancelled">Cancelled</option>}
              {isEdit && <option value="overdue">Overdue</option>}
            </FormSelect>
          </div>
          {isEdit && (
            <p className="text-xs text-gray-400">To change the budget, use the "Request Budget Revision" option on the activity detail page.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link to={isEdit ? `/activities/${id}` : '/activities'}
            className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Activity' : 'Create Activity'}
          </button>
        </div>
      </form>
    </div>
  );
}
