import { useCallback, useEffect, useMemo, useState } from 'react';
import { geoApi } from '../../../api';
import type { GeoFilters, GeoPoint, GeoSummary } from '../../../api/geo';
import Modal from '../Modal';
import SearchableSelect from '../SearchableSelect';
import { toast } from '../Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName?: string;
  /** Admin / project manager only. Clients (guests) and other viewers can look but not download. */
  canExport: boolean;
  onShowOnMap: (pointId: number) => void;
}

const ctl = 'rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400';
const SIZES = [50, 100, 200];

const copy = (text: string, what: string) => {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error('Could not copy'));
};

type Col = { key: string; label: string; sort: string; cls?: string };

export default function GeoTableModal({ isOpen, onClose, projectId, projectName, canExport, onShowOnMap }: Props) {
  const [summary, setSummary] = useState<GeoSummary | null>(null);
  const [layerId, setLayerId] = useState<number | ''>('');
  const [regionId, setRegionId] = useState<number | ''>('');
  const [districtId, setDistrictId] = useState<number | ''>('');
  const [councilId, setCouncilId] = useState<number | ''>('');
  const [wardId, setWardId] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');
  const [sort, setSort] = useState('id');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [size, setSize] = useState(50);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ results: GeoPoint[]; total: number; totalPages: number }>({ results: [], total: 0, totalPages: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { const t = setTimeout(() => setQLive(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    if (!isOpen) return;
    geoApi.summary(projectId).then((r) => setSummary(r.data)).catch(() => undefined);
  }, [isOpen, projectId]);

  const filters = useMemo<GeoFilters>(() => ({
    layer_ids: layerId === '' ? '' : String(layerId), region_id: regionId, district_id: districtId, council_id: councilId, ward_id: wardId, q: qLive,
  }), [layerId, regionId, districtId, councilId, wardId, qLive]);

  // go back to page 1 whenever what is listed changes
  useEffect(() => { setPage(1); }, [filters, size, sort, dir]);

  const load = useCallback(() => {
    if (!isOpen) return;
    setBusy(true); setError('');
    geoApi.list(projectId, { ...filters, page, limit: size, sort, dir })
      .then((r) => setData({ results: r.data.results, total: r.data.total, totalPages: r.data.totalPages }))
      .catch((e) => setError(e?.response?.data?.message ?? 'Could not load the list'))
      .finally(() => setBusy(false));
  }, [isOpen, projectId, filters, page, size, sort, dir]);
  useEffect(load, [load]);

  const places = useMemo(() => summary?.places ?? [], [summary]);
  const uniq = (rows: [number, string][]) => [...new Map(rows).entries()];
  const regionOpts = useMemo(() => uniq(places.map((p) => [p.region_id, p.region])), [places]);
  const districtOpts = useMemo(() => uniq(places.filter((p) => !regionId || p.region_id === regionId).map((p) => [p.district_id, p.district])), [places, regionId]);
  const councilOpts = useMemo(() => uniq(places.filter((p) => (!regionId || p.region_id === regionId) && (!districtId || p.district_id === districtId)).map((p) => [p.council_id, p.council])), [places, regionId, districtId]);
  const wardOpts = useMemo(() => uniq(places.filter((p) => (!regionId || p.region_id === regionId) && (!districtId || p.district_id === districtId) && (!councilId || p.council_id === councilId)).map((p) => [p.ward_id, p.ward])), [places, regionId, districtId, councilId]);
  const num = (v: string) => (v === '' ? '' : Number(v));

  const layers = useMemo(() => summary?.layers ?? [], [summary]);
  const noLabel = 'Camera no.';

  const cols: Col[] = [
    { key: 'point_id', label: 'Object ID', sort: 'id', cls: 'text-right tabular-nums' },
    { key: 'layer_name', label: 'Layer', sort: 'layer' },
    { key: 'region', label: 'Region', sort: 'region' },
    { key: 'district', label: 'District', sort: 'district' },
    { key: 'council', label: 'Council', sort: 'council' },
    { key: 'ward', label: 'Ward', sort: 'ward' },
    { key: 'street', label: 'Street', sort: 'street' },
    { key: 'point_no', label: noLabel, sort: 'point_no' },
    { key: 'road_name', label: 'Road name', sort: 'road' },
    { key: 'global_id', label: 'Global ID', sort: '' },
    { key: 'latitude', label: 'Latitude', sort: 'lat', cls: 'tabular-nums' },
    { key: 'longitude', label: 'Longitude', sort: 'lng', cls: 'tabular-nums' },
  ];

  const toggleSort = (s: string) => {
    if (!s) return;
    if (sort === s) setDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSort(s); setDir('asc'); }
  };

  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, data.total);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Coordinates list${projectName ? ` · ${projectName}` : ''}`} size="full">
      <div className="flex flex-col h-full min-h-0">
        {/* filters */}
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search no., road, street, ward…" aria-label="Search list" className={`${ctl} w-56`} />
          {layers.length > 1 && (
            <SearchableSelect compact ariaLabel="Layer" placeholder="All layers" allLabel="All layers" className="w-44" value={String(layerId)}
              options={layers.map((l) => ({ value: String(l.layer_id), label: l.name }))} onChange={(v) => setLayerId(num(v))} />
          )}
          <SearchableSelect compact ariaLabel="Region" placeholder="All regions" allLabel="All regions" className="w-44" value={String(regionId)}
            options={regionOpts.map(([id, n]) => ({ value: String(id), label: n }))}
            onChange={(v) => { setRegionId(num(v)); setDistrictId(''); setCouncilId(''); setWardId(''); }} />
          <SearchableSelect compact ariaLabel="District" placeholder="All districts" allLabel="All districts" className="w-44" value={String(districtId)}
            options={districtOpts.map(([id, n]) => ({ value: String(id), label: n }))}
            onChange={(v) => { setDistrictId(num(v)); setCouncilId(''); setWardId(''); }} />
          <SearchableSelect compact ariaLabel="Council" placeholder="All councils" allLabel="All councils" className="w-44" value={String(councilId)}
            options={councilOpts.map(([id, n]) => ({ value: String(id), label: n }))}
            onChange={(v) => { setCouncilId(num(v)); setWardId(''); }} />
          <SearchableSelect compact ariaLabel="Ward" placeholder="All wards" allLabel="All wards" className="w-44" value={String(wardId)}
            options={wardOpts.map(([id, n]) => ({ value: String(id), label: n }))} onChange={(v) => setWardId(num(v))} />
          {canExport && (
            <button type="button" onClick={() => geoApi.exportCsv(projectId, filters)} className="ml-auto px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Export CSV</button>
          )}
        </div>

        {/* table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} scope="col" aria-sort={sort === c.sort && c.sort ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`bg-gray-900 text-white text-left font-semibold whitespace-nowrap px-3 py-2 border-r border-gray-700 ${c.cls?.includes('text-right') ? 'text-right' : ''}`}>
                    {c.sort ? (
                      <button type="button" onClick={() => toggleSort(c.sort)} className="flex items-center gap-1 hover:text-brand-300" aria-label={`Sort by ${c.label}`}>
                        {c.label}<span className="text-[10px] opacity-70">{sort === c.sort ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    ) : c.label}
                  </th>
                ))}
                <th className="bg-gray-900 text-white px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {data.results.map((p, i) => (
                <tr key={p.point_id} className={`${i % 2 ? 'bg-gray-50/70 dark:bg-gray-800/40' : ''} hover:bg-brand-50 dark:hover:bg-brand-500/10`}>
                  {cols.map((c) => {
                    const raw = p[c.key as keyof GeoPoint];
                    const lat = c.key === 'latitude' || c.key === 'longitude';
                    const txt = raw == null || raw === '' ? '' : lat ? Number(raw).toFixed(6) : String(raw);
                    return (
                      <td key={c.key} className={`px-3 py-1.5 border-b border-r border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200 whitespace-nowrap ${c.cls ?? ''}`}>
                        {c.key === 'global_id' && txt ? (
                          <button type="button" title="Copy Global ID" onClick={() => copy(txt, 'Global ID')} className="font-mono text-xs hover:text-brand-500">{txt}</button>
                        ) : lat ? (
                          <button type="button" title="Copy latitude, longitude" onClick={() => copy(`${Number(p.latitude).toFixed(6)}, ${Number(p.longitude).toFixed(6)}`, 'Coordinates')} className="hover:text-brand-500">{txt}</button>
                        ) : txt}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 text-right">
                    <button type="button" onClick={() => onShowOnMap(p.point_id)} className="text-xs text-brand-500 hover:underline whitespace-nowrap">Show on map</button>
                  </td>
                </tr>
              ))}
              {!busy && data.results.length === 0 && (
                <tr><td colSpan={cols.length + 1} className="p-10 text-center text-gray-400">{error || (summary && summary.total === 0 ? 'No map points for this project yet.' : 'Nothing matches these filters.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* pager */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
          <span>{busy ? 'Loading…' : `${from.toLocaleString()}–${to.toLocaleString()} of ${data.total.toLocaleString()}`}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">Rows
              <select aria-label="Rows per page" className={ctl} value={size} onChange={(e) => setSize(Number(e.target.value))}>{SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <button type="button" disabled={page <= 1} onClick={() => setPage((x) => x - 1)} className="px-3 py-1 border rounded disabled:opacity-40 dark:border-gray-700">Prev</button>
            <span>Page {page} of {data.totalPages}</span>
            <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((x) => x + 1)} className="px-3 py-1 border rounded disabled:opacity-40 dark:border-gray-700">Next</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
