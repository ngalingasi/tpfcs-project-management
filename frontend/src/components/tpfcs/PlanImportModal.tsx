import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { FormInput, FormSelect } from './FormField';
import { planApi, usersApi } from '../../api';
import type { PlanImportResult } from '../../api/plan';
import type { UserRecord } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Import into this project. Leave out to create a new project from the file. */
  projectId?: number;
  /** Pre-fill the Week 1 date (e.g. the project's start date). */
  defaultStartDate?: string;
  onImported: (projectId: number) => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

export default function PlanImportModal({ isOpen, onClose, projectId, defaultStartDate, onImported }: Props) {
  const isNew = !projectId;
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate ?? '');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [managerId, setManagerId] = useState('');
  const [managers, setManagers] = useState<UserRecord[]>([]);

  const [busy, setBusy] = useState<'check' | 'import' | null>(null);
  const [result, setResult] = useState<PlanImportResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFile(null); setResult(null); setError(''); setProjectName('');
    setEstimatedCost(''); setManagerId(''); setStartDate(defaultStartDate ?? '');
    if (fileRef.current) fileRef.current.value = '';
    if (isNew) {
      usersApi.list({ limit: 200, status: 'active' })
        .then((r) => setManagers(r.data.results))
        .catch(() => setManagers([]));
    }
  }, [isOpen, isNew, defaultStartDate]);

  // Any change to the inputs invalidates the last check.
  const touch = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setResult(null); setError(''); };

  const run = async (dryRun: boolean) => {
    if (!file) { setError('Choose an .xlsx file first.'); return; }
    if (isNew && !projectName.trim()) { setError('Enter a project name.'); return; }
    setBusy(dryRun ? 'check' : 'import');
    setError('');
    try {
      const r = await planApi.import({
        file, projectId, dryRun,
        projectName: projectName.trim(),
        startDate: startDate || undefined,
        estimatedCost: estimatedCost || undefined,
        projectManagerId: managerId || undefined,
      });
      setResult(r);
      if (r.imported && r.project_id) onImported(r.project_id);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not read the file. Make sure it is a valid .xlsx workbook.');
    } finally {
      setBusy(null);
    }
  };

  const canImport = !!result?.ok && !result.imported && busy === null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNew ? 'Create project from plan' : 'Import plan into project'} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload a plan in the template layout. Sections become Objectives, tasks become Activities,
          sub-tasks (1.2.1) become Sub-activities and the AFTER column becomes dependencies.{' '}
          <button type="button" onClick={() => planApi.downloadTemplate()} className="text-brand-500 hover:underline">
            Download the template
          </button>
        </p>

        {isNew && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FormInput label="Project name" required value={projectName}
                onChange={(e) => touch(setProjectName)(e.target.value)} placeholder="e.g. Tanzania Safe City" />
            </div>
            <FormSelect label="Project manager" value={managerId} onChange={(e) => touch(setManagerId)(e.target.value)}>
              <option value="">None yet</option>
              {managers.map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </FormSelect>
            <FormInput label="Estimated cost (optional)" type="number" min="0" value={estimatedCost}
              onChange={(e) => touch(setEstimatedCost)(e.target.value)} placeholder="Defaults to plan budgets" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormInput label="Week 1 starts on" type="date" value={startDate}
            onChange={(e) => touch(setStartDate)(e.target.value)} />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Plan file (.xlsx) <span className="text-red-500">*</span>
            </label>
            <input ref={fileRef} type="file" accept=".xlsx"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(''); }}
              className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:px-3 file:py-2 file:text-sm file:text-gray-700 dark:file:text-gray-300" />
          </div>
        </div>
        <p className="text-xs text-gray-400 -mt-2">
          Needed when START/END use weeks (W1, W2…). Week 1 is the week beginning on this date; leave empty if the file has real dates.
        </p>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}

        {result && (
          <div className="space-y-3">
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
                <p className="text-sm font-semibold text-red-600 mb-1">
                  {result.errors.length} problem{result.errors.length > 1 ? 's' : ''} to fix before importing
                </p>
                <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
                  {result.errors.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}

            {result.ok && (
              <div className="rounded-lg border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-3">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                  {result.imported ? 'Imported successfully' : 'File looks good. This will create:'}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  {[
                    ['Objectives', result.summary.objectives],
                    ['Targets', result.summary.targets],
                    ['Activities', result.summary.activities],
                    ['Sub-activities', result.summary.sub_activities],
                    ['Dependencies', result.summary.dependencies],
                    ['Budget', result.summary.total_budget ? fmt(result.summary.total_budget) : '—'],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-md bg-white/70 dark:bg-gray-900/40 py-1.5">
                      <div className="text-sm font-bold text-gray-800 dark:text-white">{v}</div>
                      <div className="text-[10px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Schedule: {fmtDate(result.summary.first_date)} → {fmtDate(result.summary.last_date)}
                  {result.summary.schedule_overlaps > 0 &&
                    ` · ${result.summary.schedule_overlaps} task(s) start before a predecessor ends (kept as in your file)`}
                </p>
              </div>
            )}

            {result.warnings.length > 0 && (
              <details className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                <summary className="text-sm font-medium text-amber-700 dark:text-amber-400 cursor-pointer">
                  {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''} (import is still allowed)
                </summary>
                <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc pl-4 mt-2 space-y-0.5 max-h-36 overflow-y-auto">
                  {result.warnings.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </details>
            )}

            {result.ok && result.outline.length > 0 && (
              <details className="text-xs text-gray-600 dark:text-gray-400">
                <summary className="cursor-pointer text-sm">Sections found ({result.outline.length})</summary>
                <ul className="mt-1 space-y-0.5 max-h-36 overflow-y-auto">
                  {result.outline.map((o) => (
                    <li key={o.code}><span className="font-mono">{o.code}</span> {o.title} <span className="text-gray-400">· {o.tasks} tasks</span></li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            {result?.imported ? 'Close' : 'Cancel'}
          </button>
          {!result?.imported && (
            <>
              <button type="button" onClick={() => run(true)} disabled={busy !== null || !file}
                className="px-4 py-2 text-sm border border-brand-500 text-brand-500 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:opacity-50">
                {busy === 'check' ? 'Checking…' : 'Check file'}
              </button>
              <button type="button" onClick={() => run(false)} disabled={!canImport}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
                {busy === 'import' ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
