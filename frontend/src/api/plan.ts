import client from './client';

export interface PlanRow {
  type: 'objective' | 'activity';
  id: number;
  objective_id: number;
  code: string;
  has_code: boolean;
  depth: 1 | 2 | 3;
  name: string;
  lead: string | null;
  after: string[];
  start_date: string | null;
  end_date: string | null;
  start_week: number | null;
  end_week: number | null;
  progress: number;
  status: string;
  assigned_user_name: string | null;
}

export interface PlanData {
  project: {
    project_id: number;
    name: string;
    base_date: string | null;
    last_date: string | null;
    total_weeks: number;
  };
  rows: PlanRow[];
}

export interface PlanImportResult {
  ok: boolean;
  dry_run: boolean;
  imported: boolean;
  project_id?: number;
  summary: {
    layout: 'template' | 'legacy';
    objectives: number;
    targets: number;
    activities: number;
    sub_activities: number;
    dependencies: number;
    schedule_overlaps: number;
    base_date: string | null;
    first_date: string | null;
    last_date: string | null;
    total_budget: number;
  };
  outline: { code: string; title: string; tasks: number }[];
  warnings: string[];
  errors: string[];
}

export interface PlanImportOptions {
  file: File;
  /** Existing project to import into. Omit to create a new project. */
  projectId?: number;
  projectName?: string;
  startDate?: string;
  estimatedCost?: string;
  projectManagerId?: string;
  dryRun: boolean;
}

/** Save a blob response as a file, using the server's file name when given. */
function saveBlob(blob: Blob, disposition: string | undefined, fallback: string) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? fallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function download(path: string, fallback: string) {
  const res = await client.get<Blob>(path, { responseType: 'blob', timeout: 120000 });
  saveBlob(res.data, res.headers['content-disposition'] as string | undefined, fallback);
}

export const planApi = {
  get: (projectId: number) => client.get<PlanData>(`/projects/${projectId}/plan`),

  /** Validate (dryRun) or perform an import. A 422 still carries the validation report. */
  import: async (o: PlanImportOptions): Promise<PlanImportResult> => {
    const fd = new FormData();
    fd.append('file', o.file);
    fd.append('dry_run', String(o.dryRun));
    if (o.startDate) fd.append('start_date', o.startDate);
    if (!o.projectId) {
      if (o.projectName) fd.append('project_name', o.projectName);
      if (o.estimatedCost) fd.append('estimated_cost', o.estimatedCost);
      if (o.projectManagerId) fd.append('project_manager_id', o.projectManagerId);
    }
    const url = o.projectId ? `/projects/${o.projectId}/plan/import` : '/projects/plan/import';
    const res = await client.post<PlanImportResult>(url, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      validateStatus: (s) => s === 200 || s === 201 || s === 422,
    });
    return res.data;
  },

  downloadTemplate: () => download('/projects/plan/template', 'project-plan-template.xlsx'),
  exportExcel: (projectId: number) => download(`/projects/${projectId}/plan/export.xlsx`, 'plan.xlsx'),
  exportPdf: (projectId: number) => download(`/projects/${projectId}/plan/export.pdf`, 'plan.pdf'),
};
