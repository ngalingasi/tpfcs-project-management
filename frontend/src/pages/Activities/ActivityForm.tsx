import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import { activitiesApi, targetsApi, objectivesApi, projectsApi, lookupsApi, usersApi } from '../../api';
import type { Target, Region, UserRecord } from '../../types';
import { FormInput, FormSelect, FormTextArea, FormDateInput } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

// ── Defined OUTSIDE to prevent remount on keystroke → focus loss ──────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-100 dark:border-gray-800">{title}</h2>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ActivityForm() {
  const { id }         = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const isEdit         = !!id;

  const fromProjectId  = searchParams.get('project_id');
  const fromMainId     = searchParams.get('main_activity_id');

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    target_id:        searchParams.get('target_id') ?? '',
    main_activity_id: fromMainId ?? '',
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
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // ── Lookup data ─────────────────────────────────────────────────────────────
  const [projects,          setProjects]          = useState<{ project_id: number; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    fromProjectId ? Number(fromProjectId) : null
  );
  const [targets,           setTargets]           = useState<Target[]>([]);
  const [projectRegions,    setProjectRegions]    = useState<Region[]>([]);
  const [users,             setUsers]             = useState<UserRecord[]>([]);
  const [parentActivities,  setParentActivities]  = useState<{ activity_id: number; name: string }[]>([]);

  const [initLoading,    setInitLoading]    = useState(true);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  // ── Step 1: load projects list + users on mount ─────────────────────────────
  useEffect(() => {
    const init = async () => {
      setInitLoading(true);
      try {
        const [pRes, uRes] = await Promise.all([
          projectsApi.list({ limit: 100 }),
          usersApi.list({ limit: 200, status: 'active' }),
        ]);
        setProjects(pRes.data.results.map(p => ({ project_id: p.project_id, name: p.name })));
        setUsers(uRes.data.results);

        // If editing, load the existing activity
        if (isEdit) {
          const aRes = await activitiesApi.get(Number(id));
          const a    = aRes.data;
          setForm({
            target_id:        a.target_id?.toString()        ?? '',
            main_activity_id: a.main_activity_id?.toString() ?? '',
            region_id:        a.region_id?.toString()        ?? '',
            name:             a.name             ?? '',
            description:      a.description      ?? '',
            council:          a.council          ?? '',
            ward:             a.ward             ?? '',
            street:           a.street           ?? '',
            road_name:        a.road_name        ?? '',
            latitude:         a.latitude?.toString()  ?? '',
            longitude:        a.longitude?.toString() ?? '',
            global_id:        (a as any).global_id    ?? '',
            assigned_user_id: a.assigned_user_id?.toString() ?? '',
            supervisor_id:    a.supervisor_id?.toString()    ?? '',
            start_date:       a.start_date?.slice(0, 10) ?? '',
            end_date:         a.end_date?.slice(0, 10)   ?? '',
            budgeted_amount:  a.budgeted_amount?.toString() ?? '',
            status:           a.status ?? 'pending',
          });
          // Find which project this activity belongs to
          if (a.target_id) {
            for (const proj of pRes.data.results) {
              const oRes = await objectivesApi.listByProject(proj.project_id);
              let found = false;
              for (const obj of oRes.data) {
                const tRes = await targetsApi.listByObjective(obj.objective_id);
                if (tRes.data.some(t => t.target_id === a.target_id)) {
                  setSelectedProjectId(proj.project_id);
                  found = true; break;
                }
              }
              if (found) break;
            }
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Failed to load form data');
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, [id]);

  // ── Step 2: load targets + regions when project selected ────────────────────
  useEffect(() => {
    if (!selectedProjectId) {
      setTargets([]);
      setProjectRegions([]);
      return;
    }
    setTargetsLoading(true);
    const load = async () => {
      try {
        const [oRes, projRes] = await Promise.all([
          objectivesApi.listByProject(selectedProjectId),
          projectsApi.get(selectedProjectId),
        ]);
        setProjectRegions(projRes.data.regions ?? []);
        const all: Target[] = [];
        for (const obj of oRes.data) {
          const tRes = await targetsApi.listByObjective(obj.objective_id);
          tRes.data.forEach(t => all.push({ ...t, name: `${obj.title} → ${t.name}` } as any));
        }
        setTargets(all);
      } catch { /* silent */ }
      finally { setTargetsLoading(false); }
    };
    load();
  }, [selectedProjectId]);

  // ── Step 3: load parent activities when target selected ─────────────────────
  useEffect(() => {
    if (!form.target_id) { setParentActivities([]); return; }
    activitiesApi.list({ target_id: Number(form.target_id), limit: 200 })
      .then(res => setParentActivities(
        res.data.results.filter(a => !(a as any).main_activity_id && a.status !== 'cancelled')
      ))
      .catch(() => {});
  }, [form.target_id]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())    { setError('Activity name is required'); return; }
    if (!form.target_id)      { setError('Please select a project and target'); return; }
    if (!isEdit && !form.budgeted_amount) { setError('Budgeted amount is required'); return; }

    setSaving(true); setError('');
    try {
      const payload: any = {
        name:             form.name,
        description:      form.description      || null,
        region_id:        form.region_id        ? Number(form.region_id)        : null,
        council:          form.council          || null,
        ward:             form.ward             || null,
        street:           form.street           || null,
        road_name:        form.road_name        || null,
        latitude:         form.latitude         ? Number(form.latitude)         : null,
        longitude:        form.longitude        ? Number(form.longitude)        : null,
        global_id:        form.global_id        || null,
        assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
        supervisor_id:    form.supervisor_id    ? Number(form.supervisor_id)    : null,
        start_date:       form.start_date       || null,
        end_date:         form.end_date         || null,
        status:           form.status,
        main_activity_id: form.main_activity_id ? Number(form.main_activity_id) : null,
      };
      if (!isEdit) {
        payload.target_id       = Number(form.target_id);
        payload.budgeted_amount = Number(form.budgeted_amount);
      }

      if (isEdit) {
        await activitiesApi.update(Number(id), payload);
        toast.success('Activity updated', 'Changes saved successfully');
        navigate(`/activities/${id}`);
      } else {
        const res = await activitiesApi.create(payload);
        toast.success('Activity created', res.data.name);
        if (fromProjectId) navigate(`/projects/${fromProjectId}`);
        else navigate(`/activities/${res.data.activity_id}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save activity';
      toast.error('Save failed', msg);
      setError(msg);
    } finally { setSaving(false); }
  };

  if (initLoading) return (
    <div className="animate-pulse max-w-3xl mx-auto space-y-4">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  );

  const selectedTarget = targets.find(t => t.target_id === Number(form.target_id));

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {fromProjectId
            ? <><Link to="/projects" className="hover:text-brand-500">Projects</Link><span>/</span>
                <Link to={`/projects/${fromProjectId}`} className="hover:text-brand-500">Project</Link></>
            : <Link to="/activities" className="hover:text-brand-500">Activities</Link>}
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300">{isEdit ? 'Edit Activity' : 'New Activity'}</span>
        </div>
        <BackButton />
      </div>

      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        {isEdit ? 'Edit Activity' : 'Create New Activity'}
      </h1>

      {form.main_activity_id && (
        <div className="mb-5 p-3 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-sm text-purple-700 dark:text-purple-400">
          Creating sub-activity linked to parent Activity #{form.main_activity_id}
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-500/20">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Activity Details ── */}
        <Section title="Activity Details">

          {/* 1. Project selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProjectId ?? ''}
              onChange={e => {
                const pid = e.target.value ? Number(e.target.value) : null;
                setSelectedProjectId(pid);
                setForm(f => ({ ...f, target_id: '', main_activity_id: '' }));
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400"
            >
              <option value="">— Select a project —</option>
              {projects.map(p => (
                <option key={p.project_id} value={p.project_id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Target selector — enabled only after project chosen */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Target <span className="text-red-500">*</span>
            </label>
            <select
              value={form.target_id}
              onChange={e => set('target_id', e.target.value)}
              disabled={!selectedProjectId || targetsLoading}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedProjectId ? '— Select a project first —'
                  : targetsLoading ? 'Loading targets...'
                  : targets.length === 0 ? 'No targets in this project'
                  : '— Select a target —'}
              </option>
              {targets.map(t => (
                <option key={t.target_id} value={t.target_id}>
                  {t.name}{t.allocated_budget > 0
                    ? ` (TZS ${Number(t.allocated_budget).toLocaleString()})`
                    : ' ⚠ no budget'}
                </option>
              ))}
            </select>
          </div>

          {/* Budget status feedback */}
          {selectedTarget && (
            selectedTarget.allocated_budget <= 0
              ? <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 p-2 rounded-lg">
                  This target has no budget allocated — allocate budget first via the project Targets tab.
                </p>
              : <p className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 p-2 rounded-lg">
                  Available budget: TZS {Number(selectedTarget.allocated_budget).toLocaleString()}
                </p>
          )}

          {/* 3. Parent activity dropdown */}
          {form.target_id && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Parent Activity
                <span className="ml-1 font-normal text-gray-400">(optional — select to create a sub-activity)</span>
              </label>
              <select
                value={form.main_activity_id}
                onChange={e => set('main_activity_id', e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400"
              >
                <option value="">— None (top-level activity) —</option>
                {parentActivities.map(a => (
                  <option key={a.activity_id} value={a.activity_id}>
                    #{a.activity_id} — {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <FormInput label="Activity Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Construct borehole at Mwanakwerekwe" />
          <FormTextArea label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe this activity..." />
        </Section>

        {/* ── Location ── */}
        <Section title="Location">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Region</label>
              <select value={form.region_id} onChange={e => set('region_id', e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400">
                <option value="">
                  {!selectedProjectId ? 'Select a project first' : 'Select region...'}
                </option>
                {projectRegions.map(r => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
              </select>
            </div>
            <FormInput label="Council" value={form.council} onChange={e => set('council', e.target.value)} placeholder="Council name" />
            <FormInput label="Ward" value={form.ward} onChange={e => set('ward', e.target.value)} placeholder="Ward name" />
            <FormInput label="Street" value={form.street} onChange={e => set('street', e.target.value)} placeholder="Street name" />
            <FormInput label="Road" value={form.road_name} onChange={e => set('road_name', e.target.value)} placeholder="Road name" />
            <FormInput label="Global ID" value={form.global_id} onChange={e => set('global_id', e.target.value)} placeholder="GIS global ID" />
            <FormInput label="Latitude" type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="-6.1659" />
            <FormInput label="Longitude" type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="39.2026" />
          </div>
        </Section>

        {/* ── Assignment & Schedule ── */}
        <Section title="Assignment & Schedule">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Assigned To" value={form.assigned_user_id} onChange={e => set('assigned_user_id', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </FormSelect>
            <FormSelect label="Supervisor" value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)}>
              <option value="">None</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </FormSelect>
            <FormDateInput label="Start Date" id="act-start" value={form.start_date} onChange={v => set('start_date', v)} />
            <FormDateInput label="End Date" id="act-end" value={form.end_date} onChange={v => set('end_date', v)} />
          </div>
        </Section>

        {/* ── Budget & Status ── */}
        <Section title="Budget & Status">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FormInput
                label={isEdit ? 'Budgeted Amount (read-only)' : 'Budgeted Amount (TZS)'}
                required={!isEdit}
                type="number"
                value={form.budgeted_amount}
                onChange={e => set('budgeted_amount', e.target.value)}
                placeholder="500000"
                disabled={isEdit}
              />
              {isEdit && <p className="text-xs text-gray-400 mt-1">Use Budget Revision on the activity detail to change.</p>}
            </div>
            <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              {isEdit && <option value="completed">Completed</option>}
              {isEdit && <option value="cancelled">Cancelled</option>}
              {isEdit && <option value="overdue">Overdue</option>}
            </FormSelect>
          </div>
        </Section>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pb-8">
          <Link to={isEdit ? `/activities/${id}` : fromProjectId ? `/projects/${fromProjectId}` : '/activities'}
            className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
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
