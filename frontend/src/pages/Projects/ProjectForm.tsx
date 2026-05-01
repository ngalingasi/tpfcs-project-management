import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { projectsApi, lookupsApi, usersApi } from '../../api';
import type { Sector, Region, Implementer, UserRecord } from '../../types';
import { FormInput, FormSelect, FormTextArea, FormDateInput } from '../../components/tpfcs/FormField';

export default function ProjectForm() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const isEdit    = !!id;

  const [form, setForm] = useState({
    name: '', programme_name: '', project_nature: '', sector_id: '',
    start_date: '', end_date: '', fund_structure: '', funding: '',
    estimated_cost: '', project_life_span: '', project_background: '',
    cost_center: '', project_reference: '', relevancy_fypds: '',
    implementation_modality: '', compensation: '', job_created_no: '',
    project_manager_id: '', regions: [] as number[], implementers: [] as any[],
  });
  const [sectors,      setSectors]      = useState<Sector[]>([]);
  const [regions,      setRegions]      = useState<Region[]>([]);
  const [implementers, setImplementers] = useState<Implementer[]>([]);
  const [managers,     setManagers]     = useState<UserRecord[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      lookupsApi.sectors(), lookupsApi.regions(), lookupsApi.implementers(),
      usersApi.list({ limit: 100, status: 'active' }),
    ]).then(([s, r, i, u]) => {
      setSectors(s.data); setRegions(r.data);
      setImplementers(i.data); // All active users can be assigned as project manager
      setManagers(u.data.results);
    }).finally(() => setLoading(false));

    if (isEdit) {
      projectsApi.get(Number(id)).then(res => {
        const p = res.data;
        setForm({
          name: p.name ?? '', programme_name: p.programme_name ?? '',
          project_nature: p.project_nature ?? '', sector_id: p.sector_id?.toString() ?? '',
          start_date: p.start_date?.slice(0, 10) ?? '', end_date: p.end_date?.slice(0, 10) ?? '',
          fund_structure: p.fund_structure ?? '', funding: p.funding ?? '',
          estimated_cost: p.estimated_cost?.toString() ?? '',
          project_life_span: p.project_life_span?.toString() ?? '',
          project_background: p.project_background ?? '',
          cost_center: p.cost_center ?? '', project_reference: p.project_reference ?? '',
          relevancy_fypds: p.relevancy_fypds ?? '', implementation_modality: p.implementation_modality ?? '',
          compensation: p.compensation ?? '', job_created_no: p.job_created_no ?? '',
          project_manager_id: p.project_manager_id?.toString() ?? '',
          regions: p.regions?.map(r => r.region_id) ?? [],
          implementers: p.implementers ?? [],
        });
      });
    }
  }, [id]);

  const toggleRegion = (rid: number) => {
    setForm(f => ({
      ...f,
      regions: f.regions.includes(rid) ? f.regions.filter(r => r !== rid) : [...f.regions, rid],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        sector_id: form.sector_id ? Number(form.sector_id) : null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
        project_life_span: form.project_life_span ? Number(form.project_life_span) : null,
        project_manager_id: form.project_manager_id ? Number(form.project_manager_id) : null,
      };
      if (isEdit) {
        await projectsApi.update(Number(id), payload);
        navigate(`/projects/${id}`);
      } else {
        const res = await projectsApi.create(payload);
        navigate(`/projects/${res.data.project_id}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save project');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 animate-pulse"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4" /><div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-5">
        <Link to="/projects" className="hover:text-brand-500">Projects</Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300">{isEdit ? 'Edit Project' : 'New Project'}</span>
      </div>

      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        {isEdit ? 'Edit Project' : 'Create New Project'}
      </h1>

      {error && <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-500/20">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Basic Information</h2>
          <FormInput label="Project Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Enter project name" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Programme Name" value={form.programme_name} onChange={e => set('programme_name', e.target.value)} placeholder="Programme name" />
            <FormInput label="Project Reference" value={form.project_reference} onChange={e => set('project_reference', e.target.value)} placeholder="e.g. MoW/2024/001" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Sector" value={form.sector_id} onChange={e => set('sector_id', e.target.value)}>
              <option value="">Select sector...</option>
              {sectors.map(s => <option key={s.sector_id} value={s.sector_id}>{s.name}</option>)}
            </FormSelect>
            <FormSelect label="Project Manager" value={form.project_manager_id} onChange={e => set('project_manager_id', e.target.value)}>
              <option value="">Select manager...</option>
              {managers.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </FormSelect>
          </div>
          <FormTextArea label="Project Background" value={form.project_background} onChange={e => set('project_background', e.target.value)} placeholder="Describe the project background..." />
        </div>

        {/* Timeline & Budget */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Timeline & Budget</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <FormDateInput label="Start Date" id="proj-start-date" value={form.start_date} onChange={v => set('start_date', v)} />
            <FormDateInput label="End Date" id="proj-end-date" value={form.end_date} onChange={v => set('end_date', v)} />
            <FormInput label="Life Span (years)" type="number" value={form.project_life_span} onChange={e => set('project_life_span', e.target.value)} placeholder="3" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Estimated Cost (TZS)" type="number" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} placeholder="5000000" />
            <FormInput label="Cost Center" value={form.cost_center} onChange={e => set('cost_center', e.target.value)} placeholder="CC-001" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Fund Structure" value={form.fund_structure} onChange={e => set('fund_structure', e.target.value)} placeholder="Government / Donor" />
            <FormInput label="Funding Source" value={form.funding} onChange={e => set('funding', e.target.value)} placeholder="Ministry of..." />
          </div>
        </div>

        {/* Additional */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Additional Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Project Nature" value={form.project_nature} onChange={e => set('project_nature', e.target.value)} placeholder="Infrastructure / Service" />
            <FormInput label="Implementation Modality" value={form.implementation_modality} onChange={e => set('implementation_modality', e.target.value)} placeholder="Direct / Contracted" />
            <FormInput label="Relevancy (FYDP)" value={form.relevancy_fypds} onChange={e => set('relevancy_fypds', e.target.value)} placeholder="FYDP III" />
            <FormInput label="Jobs to be Created" value={form.job_created_no} onChange={e => set('job_created_no', e.target.value)} placeholder="150" />
          </div>
        </div>

        {/* Regions */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Regions</h2>
          <div className="flex flex-wrap gap-2">
            {regions.map(r => (
              <button key={r.region_id} type="button" onClick={() => toggleRegion(r.region_id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  form.regions.includes(r.region_id)
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-400'
                }`}>
                {r.region_name}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link to={isEdit ? `/projects/${id}` : '/projects'}
            className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
