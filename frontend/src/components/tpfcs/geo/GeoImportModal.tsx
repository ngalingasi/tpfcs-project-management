import { useRef, useState } from 'react';
import Modal from '../Modal';
import { geoApi } from '../../../api';
import type { GeoImportResult } from '../../../api/geo';
import { toast } from '../Toast';

interface Props {
  projectId: number;
  regions: { region_id: number; region_name: string }[];
  onClose: () => void;
  onImported: () => void;
}

const errMsg = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed';
const Check = ({ checked, onChange, children, hint }: { checked: boolean; onChange: (v: boolean) => void; children: string; hint: string }) => (
  <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
    <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{children}<span className="block text-xs text-gray-400">{hint}</span></span>
  </label>
);

export default function GeoImportModal({ projectId, regions, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [linkRegions, setLinkRegions] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [result, setResult] = useState<GeoImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'check' | 'import' | null>(null);

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? 'check' : 'import'); setError('');
    try {
      const r = (await geoApi.importCsv(projectId, { file, dryRun, createMissing, linkRegions, skipInvalid })).data;
      setResult(r);
      if (r.imported) { toast.success('Map points imported', `${r.summary.to_insert} added, ${r.summary.to_update} updated`); onImported(); }
    } catch (e) { setError(errMsg(e)); setResult(null); } finally { setBusy(null); }
  };

  const s = result?.summary;
  const canImport = !!result && !result.imported && busy === null && !!s && s.valid_rows > 0 && (s.error_total === 0 || skipInvalid);
  const touch = (fn: (v: boolean) => void) => (v: boolean) => { fn(v); setResult(null); };

  return (
    <Modal isOpen onClose={onClose} title="Upload map points (CSV)" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Columns: <span className="font-mono">layer, region, district, council, ward, street, point_no, road_name, description, global_id, latitude, longitude</span>.
          {' '}<button type="button" onClick={() => geoApi.template()} className="text-brand-500 hover:underline">Download the template</button>.
          {' '}Uploading the same <span className="font-mono">global_id</span> again updates that point instead of adding a copy.
        </p>
        <p className="text-xs text-gray-500">
          Project regions: {regions.length ? regions.map((r) => r.region_name).join(', ') : 'none set yet'}.
          {regions.length === 1 && ' The region column may be left empty.'}
        </p>

        <input ref={fileRef} type="file" accept=".csv,.txt" aria-label="CSV file"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(''); }}
          className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:px-3 file:py-2 file:text-sm file:text-gray-700 dark:file:text-gray-300" />

        <div className="space-y-2">
          <Check checked={createMissing} onChange={touch(setCreateMissing)} hint="Districts, councils, wards, streets and layers that are not in the system yet. A misspelled name would create a new one, so check the list below.">Add places that do not exist yet</Check>
          <Check checked={linkRegions} onChange={touch(setLinkRegions)} hint="Regions in the file that the project does not have yet are added to the project.">Add the file's regions to this project</Check>
          <Check checked={skipInvalid} onChange={touch(setSkipInvalid)} hint="Import the good rows and leave out rows with problems.">Skip rows with problems</Check>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}

        {result && s && (
          <div className="space-y-3">
            {s.error_total > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
                <p className="text-sm font-semibold text-red-600 mb-1">
                  {s.error_total} problem{s.error_total > 1 ? 's' : ''} in {s.invalid_rows} row{s.invalid_rows > 1 ? 's' : ''}
                  {skipInvalid ? ' (these rows will be skipped)' : ' — fix them, or tick "Skip rows with problems"'}
                </p>
                <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>Line {e.line}: {e.message}</li>)}
                  {s.error_total > result.errors.length && <li>…and {s.error_total - result.errors.length} more</li>}
                </ul>
              </div>
            )}

            {s.valid_rows > 0 && (
              <div className="rounded-lg border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-3">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">{result.imported ? 'Imported successfully' : 'This will:'}</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  {([['Add points', s.to_insert], ['Update points', s.to_update], ['New districts', s.new_places.districts], ['New councils', s.new_places.councils], ['New wards', s.new_places.wards], ['New streets', s.new_places.streets]] as [string, number][]).map(([l, v]) => (
                    <div key={l} className="rounded-md bg-white/70 dark:bg-gray-900/40 py-1.5">
                      <div className="text-sm font-bold text-gray-800 dark:text-white">{v.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                {(s.new_layers.length > 0 || s.new_project_regions.length > 0) && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                    {s.new_layers.length > 0 && <>New layers: {s.new_layers.join(', ')}. </>}
                    {s.new_project_regions.length > 0 && <>Regions added to the project: {s.new_project_regions.join(', ')}.</>}
                  </p>
                )}
              </div>
            )}

            {result.similar.length > 0 && (
              <details className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3" open>
                <summary className="text-sm font-medium text-amber-700 dark:text-amber-400 cursor-pointer">
                  {result.similar.length} new name{result.similar.length > 1 ? 's' : ''} look like existing ones — possible typos
                </summary>
                <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc pl-4 mt-2 space-y-0.5 max-h-36 overflow-y-auto">
                  {result.similar.map((x, i) => <li key={i}>Line {x.line}: {x.level} "{x.name}" in {x.parent} is close to "{x.similar_to}"</li>)}
                </ul>
              </details>
            )}

            {result.warnings.length > 0 && (
              <details className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                <summary className="text-sm font-medium text-amber-700 dark:text-amber-400 cursor-pointer">{s.warning_total} warning{s.warning_total > 1 ? 's' : ''} (import is still allowed)</summary>
                <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc pl-4 mt-2 space-y-0.5 max-h-36 overflow-y-auto">
                  {result.warnings.map((w, i) => <li key={i}>Line {w.line}: {w.message}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">{result?.imported ? 'Close' : 'Cancel'}</button>
          {!result?.imported && (
            <>
              <button type="button" onClick={() => run(true)} disabled={busy !== null || !file}
                className="px-4 py-2 text-sm border border-brand-500 text-brand-500 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:opacity-50">{busy === 'check' ? 'Checking…' : 'Check file'}</button>
              <button type="button" onClick={() => run(false)} disabled={!canImport}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{busy === 'import' ? 'Importing…' : 'Import'}</button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
