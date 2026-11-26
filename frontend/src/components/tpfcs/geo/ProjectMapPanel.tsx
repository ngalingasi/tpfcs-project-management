import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { geoApi } from '../../../api';
import type { GeoPin, GeoSummary } from '../../../api/geo';
import Modal from '../Modal';
import GeoMap from './GeoMap';
import GeoExplorer from './GeoExplorer';
import GeoTableModal from './GeoTableModal';

interface Props { projectId: number; projectName?: string; canManage: boolean }

/** The "Map" tab of a project: a preview map, with a big-map modal and a full-page view. */
export default function ProjectMapPanel({ projectId, projectName, canManage }: Props) {
  const [summary, setSummary] = useState<GeoSummary | null>(null);
  const [pins, setPins] = useState<GeoPin[]>([]);
  const [big, setBig] = useState(false);
  const [table, setTable] = useState(false);
  const [openPoint, setOpenPoint] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let dead = false;
    Promise.all([geoApi.summary(projectId), geoApi.map(projectId)])
      .then(([s, m]) => { if (!dead) { setSummary(s.data); setPins(m.data.points); } })
      .catch((e) => { if (!dead) setError(e?.response?.data?.message ?? 'Could not load the map data'); });
    return () => { dead = true; };
  }, [projectId, big]); // reload after the big map closes (points may have changed)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-800 dark:text-white">{summary ? summary.total.toLocaleString() : '…'} points</span>
          {summary?.layers.map((l) => (
            <span key={l.layer_id} className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.name} {l.count.toLocaleString()}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTable(true)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Coordinates list</button>
          <button type="button" onClick={() => { setOpenPoint(null); setBig(true); }} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Open big map</button>
          <Link to={`/projects/${projectId}/map`} className="px-3 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">Open full page</Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {summary && summary.total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-sm text-gray-500">
          No map points for this project yet.
          {canManage && <> <button type="button" onClick={() => setBig(true)} className="text-brand-500 hover:underline">Upload a CSV</button> to add them.</>}
        </div>
      ) : (
        <div className="h-[420px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <GeoMap pins={pins} layers={summary?.layers ?? []} selectedId={null} onSelect={() => setBig(true)} fitKey={`${pins.length}`} focus={null} />
        </div>
      )}

      <Modal isOpen={big} onClose={() => setBig(false)} title={`Map${projectName ? ` · ${projectName}` : ''}`} size="full">
        {big && <GeoExplorer projectId={projectId} canManage={canManage} openPointId={openPoint} />}
      </Modal>

      <GeoTableModal isOpen={table} onClose={() => setTable(false)} projectId={projectId} projectName={projectName} canExport={canManage}
        onShowOnMap={(id) => { setTable(false); setOpenPoint(id); setBig(true); }} />
    </div>
  );
}
