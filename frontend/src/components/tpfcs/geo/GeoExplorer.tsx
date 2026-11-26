import { useCallback, useEffect, useMemo, useState } from 'react';
import { geoApi } from '../../../api';
import type { GeoFilters, GeoPin, GeoPoint, GeoSummary } from '../../../api/geo';
import Modal from '../Modal';
import SearchableSelect from '../SearchableSelect';
import { toast } from '../Toast';
import GeoMap from './GeoMap';
import { pointTitle } from '../../../utils/geoLabels';
import GeoImportModal from './GeoImportModal';

const PAGE = 40;
const sel = 'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400';
const errMsg = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const Pin = ({ color }: { color: string }) => (
  <svg width="14" height="20" viewBox="0 0 24 34" className="flex-shrink-0">
    <path d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 34 12 34s12-13.7 12-22.4C24 5.2 18.6 0 12 0z" fill={color} />
    <circle cx="12" cy="11.5" r="4.5" fill="#fff" />
  </svg>
);

interface Props {
  projectId: number;
  /** Admin or the project's manager: upload, export and delete. */
  canManage: boolean;
  /** Open this point straight away (used by "show on map" in the coordinates list). */
  openPointId?: number | null;
}

/** Google-Maps-style explorer: filters and a list on the left, the map on the right. Used in the modal and on the full page. */
export default function GeoExplorer({ projectId, canManage, openPointId }: Props) {
  const [summary, setSummary] = useState<GeoSummary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [layerOff, setLayerOff] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');
  const [regionId, setRegionId] = useState<number | ''>('');
  const [districtId, setDistrictId] = useState<number | ''>('');
  const [councilId, setCouncilId] = useState<number | ''>('');
  const [wardId, setWardId] = useState<number | ''>('');
  const [allPins, setAllPins] = useState<GeoPin[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [list, setList] = useState<{ results: GeoPoint[]; total: number; totalPages: number }>({ results: [], total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [details, setDetails] = useState<GeoPoint[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  // debounce the search box
  useEffect(() => { const t = setTimeout(() => setQLive(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  const loadSummary = useCallback(() => {
    geoApi.summary(projectId).then((r) => { setSummary(r.data); setLoadError(''); })
      .catch((e) => setLoadError(errMsg(e, 'Could not load the map data')));
  }, [projectId]);
  useEffect(loadSummary, [loadSummary]);

  const placeFilters = useMemo<GeoFilters>(() => ({ region_id: regionId, district_id: districtId, council_id: councilId, ward_id: wardId, q: qLive }), [regionId, districtId, councilId, wardId, qLive]);
  const layerIds = useMemo(() => (summary ? summary.layers.filter((l) => !layerOff.has(l.layer_id)).map((l) => l.layer_id) : []), [summary, layerOff]);
  const listFilters = useMemo<GeoFilters>(() => ({ ...placeFilters, layer_ids: layerIds.join(',') || '0' }), [placeFilters, layerIds]);

  // pins for the map (all layers; hiding a layer is instant and needs no request)
  const loadPins = useCallback(() => {
    geoApi.map(projectId, placeFilters).then((r) => { setAllPins(r.data.points); setTruncated(r.data.truncated); })
      .catch((e) => toast.error('Could not load map points', errMsg(e, '')));
  }, [projectId, placeFilters]);
  useEffect(loadPins, [loadPins]);

  const loadList = useCallback(() => {
    setBusy(true);
    geoApi.list(projectId, { ...listFilters, page, limit: PAGE })
      .then((r) => setList({ results: r.data.results, total: r.data.total, totalPages: r.data.totalPages }))
      .catch((e) => toast.error('Could not load the list', errMsg(e, '')))
      .finally(() => setBusy(false));
  }, [projectId, listFilters, page]);
  useEffect(loadList, [loadList]);
  useEffect(() => { setPage(1); setChecked(new Set()); }, [listFilters]);

  const pins = useMemo(() => allPins.filter((p) => !layerOff.has(p[1])), [allPins, layerOff]);
  const fitKey = `${regionId}|${districtId}|${councilId}|${wardId}|${qLive}|${allPins.length}`;

  // cascading place filters, built from what the project actually has
  const places = useMemo(() => summary?.places ?? [], [summary]);
  const regionOpts = useMemo(() => [...new Map(places.map((p) => [p.region_id, p.region])).entries()], [places]);
  const districtOpts = useMemo(() => [...new Map(places.filter((p) => !regionId || p.region_id === regionId).map((p) => [p.district_id, p.district])).entries()], [places, regionId]);
  const councilOpts = useMemo(() => [...new Map(places.filter((p) => (!regionId || p.region_id === regionId) && (!districtId || p.district_id === districtId)).map((p) => [p.council_id, p.council])).entries()], [places, regionId, districtId]);
  const wardOpts = useMemo(() => [...new Map(places.filter((p) => (!regionId || p.region_id === regionId) && (!districtId || p.district_id === districtId) && (!councilId || p.council_id === councilId)).map((p) => [p.ward_id, p.ward])).entries()], [places, regionId, districtId, councilId]);
  const num = (v: string) => (v === '' ? '' : Number(v));

  // clicking a pin (or a stack of pins on the same spot)
  const onPinSelect = useCallback((ids: number[]) => { setSelectedIds(ids); setActiveId(ids[0]); }, []);
  useEffect(() => {
    if (!selectedIds.length) { setDetails([]); return; }
    let dead = false;
    Promise.all(selectedIds.slice(0, 12).map((id) => geoApi.get(projectId, id).then((r) => r.data).catch(() => null)))
      .then((rows) => { if (!dead) setDetails(rows.filter(Boolean) as GeoPoint[]); });
    return () => { dead = true; };
  }, [selectedIds, projectId]);

  useEffect(() => {
    if (!openPointId) return;
    geoApi.get(projectId, openPointId).then((r) => {
      setSelectedIds([r.data.point_id]); setActiveId(r.data.point_id);
      setFocus({ lat: Number(r.data.latitude), lng: Number(r.data.longitude), nonce: Date.now() });
    }).catch(() => undefined);
  }, [openPointId, projectId]);

  const active = details.find((d) => d.point_id === activeId) ?? details[0] ?? null;

  const pick = (p: GeoPoint) => {
    setSelectedIds([p.point_id]); setActiveId(p.point_id);
    setFocus({ lat: Number(p.latitude), lng: Number(p.longitude), nonce: Date.now() });
  };

  const refreshAll = () => { loadSummary(); loadPins(); loadList(); };

  const removeOne = async (p: GeoPoint) => {
    if (!confirm(`Delete this point${p.point_no ? ` (${pointTitle(p)})` : ''}? This cannot be undone.`)) return;
    try { await geoApi.remove(projectId, p.point_id); toast.success('Point deleted'); setSelectedIds([]); refreshAll(); }
    catch (e) { toast.error('Delete failed', errMsg(e, '')); }
  };
  const removeChecked = async () => {
    if (!checked.size || !confirm(`Delete ${checked.size} selected point${checked.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    try { const r = await geoApi.removeMany(projectId, { ids: [...checked] }); toast.success(`${r.data.deleted} points deleted`); setChecked(new Set()); setSelectedIds([]); refreshAll(); }
    catch (e) { toast.error('Delete failed', errMsg(e, '')); }
  };
  const removeAllMatching = async () => {
    setDeleting(true);
    try {
      const r = await geoApi.removeMany(projectId, { filters: listFilters, expected_count: list.total });
      toast.success(`${r.data.deleted} points deleted`);
      setConfirmAll(false); setTyped(''); setSelectedIds([]); refreshAll();
    } catch (e) { toast.error('Delete failed', errMsg(e, '')); } finally { setDeleting(false); }
  };

  const toggleLayer = (id: number) => setLayerOff((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const filtered = !!(regionId || districtId || councilId || wardId || qLive || layerOff.size);
  const empty = summary && summary.total === 0;

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 bg-white dark:bg-gray-900">
      {/* ── left panel ─────────────────────────────────────────────────────────── */}
      <aside className="w-full md:w-[340px] md:flex-shrink-0 md:border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0 max-h-[45vh] md:max-h-none">
        <div className="p-3 space-y-3 border-b border-gray-200 dark:border-gray-700 max-md:overflow-y-auto">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pole no., road, street, ward…" className={sel} aria-label="Search points" />

          {summary && summary.layers.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Layers">
              {summary.layers.map((l) => {
                const off = layerOff.has(l.layer_id);
                return (
                  <button key={l.layer_id} type="button" onClick={() => toggleLayer(l.layer_id)} aria-pressed={!off}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${off ? 'border-gray-300 text-gray-400 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800'}`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: off ? '#cbd5e1' : l.color }} />
                    {l.name} <span className="text-gray-400">{l.count.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          )}

          {summary && summary.total > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <SearchableSelect compact ariaLabel="Region" placeholder="All regions" allLabel="All regions" value={String(regionId)}
                options={regionOpts.map(([id, n]) => ({ value: String(id), label: n }))}
                onChange={(v) => { setRegionId(num(v)); setDistrictId(''); setCouncilId(''); setWardId(''); }} />
              <SearchableSelect compact ariaLabel="District" placeholder="All districts" allLabel="All districts" value={String(districtId)}
                options={districtOpts.map(([id, n]) => ({ value: String(id), label: n }))}
                onChange={(v) => { setDistrictId(num(v)); setCouncilId(''); setWardId(''); }} />
              <SearchableSelect compact ariaLabel="Council" placeholder="All councils" allLabel="All councils" value={String(councilId)}
                options={councilOpts.map(([id, n]) => ({ value: String(id), label: n }))}
                onChange={(v) => { setCouncilId(num(v)); setWardId(''); }} />
              <SearchableSelect compact ariaLabel="Ward" placeholder="All wards" allLabel="All wards" value={String(wardId)}
                options={wardOpts.map(([id, n]) => ({ value: String(id), label: n }))}
                onChange={(v) => setWardId(num(v))} />
            </div>
          )}

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowImport(true)} className="px-3 py-1.5 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600">Upload CSV</button>
              <button type="button" onClick={() => geoApi.template()} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">CSV template</button>
              {!empty && <button type="button" onClick={() => geoApi.exportCsv(projectId, listFilters)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Export</button>}
            </div>
          )}
        </div>

        {/* results */}
        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
          <span>{busy ? 'Loading…' : `${list.total.toLocaleString()} point${list.total === 1 ? '' : 's'}${filtered ? ' match' : ''}`}</span>
          {canManage && list.total > 0 && (
            <span className="flex items-center gap-2">
              {checked.size > 0 && <button type="button" onClick={removeChecked} className="text-red-500 hover:underline">Delete {checked.size} selected</button>}
              <button type="button" onClick={() => { setTyped(''); setConfirmAll(true); }} className="text-gray-400 hover:text-red-500 hover:underline">Delete all {filtered ? 'matching' : ''}…</button>
            </span>
          )}
        </div>
        <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800" aria-label="Points">
          {list.results.map((p) => (
            <li key={p.point_id} className={`flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${active?.point_id === p.point_id ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`} onClick={() => pick(p)}>
              {canManage && (
                <input type="checkbox" className="mt-1" checked={checked.has(p.point_id)} aria-label={`Select point ${p.point_no ?? p.point_id}`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.point_id); else n.delete(p.point_id); return n; })} />
              )}
              <span className="mt-0.5"><Pin color={p.layer_color} /></span>
              <div className="min-w-0 text-sm">
                <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{pointTitle(p)}</div>
                <div className="text-[11px] text-gray-400">{p.layer_name}</div>
                {p.road_name && <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{p.road_name}</div>}
                <div className="text-xs text-gray-400 truncate">{[p.street, p.ward, p.district].filter(Boolean).join(', ')}</div>
              </div>
            </li>
          ))}
          {!busy && list.results.length === 0 && (
            <li className="p-6 text-center text-sm text-gray-400">
              {loadError || (empty ? (canManage ? 'No map points yet. Upload a CSV to add them.' : 'No map points for this project yet.') : 'Nothing matches these filters.')}
            </li>
          )}
        </ul>
        {list.totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-700">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40 dark:border-gray-700">Prev</button>
            <span className="text-gray-500">Page {page} of {list.totalPages}</span>
            <button type="button" disabled={page >= list.totalPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40 dark:border-gray-700">Next</button>
          </div>
        )}
      </aside>

      {/* ── map ────────────────────────────────────────────────────────────────── */}
      <section className="relative flex-1 min-h-[320px] md:min-h-0">
        <GeoMap pins={pins} layers={summary?.layers ?? []} selectedId={active?.point_id ?? null} onSelect={onPinSelect} fitKey={fitKey} focus={focus} />
        {truncated && <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-800 text-xs px-3 py-1.5 rounded-full shadow">Too many points to draw. Narrow the filters.</div>}

        {active && (
          <div className="absolute left-3 bottom-3 w-[min(380px,calc(100%-1.5rem))] max-h-[70%] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700" role="dialog" aria-label="Point details">
            <div className="flex items-start justify-between gap-2 p-4 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Pin color={active.layer_color} />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 dark:text-white truncate">{pointTitle(active)}</div>
                  <div className="text-xs text-gray-400">{active.layer_name}</div>
                  {active.road_name && <div className="text-sm text-gray-600 dark:text-gray-300">{active.road_name}</div>}
                </div>
              </div>
              <button type="button" aria-label="Close details" onClick={() => setSelectedIds([])} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            {details.length > 1 && (
              <div className="px-4 pb-2">
                <p className="text-xs text-purple-600 mb-1">{selectedIds.length} points on this spot</p>
                <div className="flex flex-wrap gap-1">
                  {details.map((d) => (
                    <button key={d.point_id} type="button" onClick={() => setActiveId(d.point_id)}
                      className={`px-2 py-0.5 text-xs rounded border ${d.point_id === active.point_id ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                      {d.point_no ? pointTitle(d) : `${d.layer_name} #${d.point_id}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <dl className="px-4 pb-3 text-sm grid grid-cols-[88px_1fr] gap-y-1">
              <dt className="text-gray-400">Region</dt><dd className="text-gray-700 dark:text-gray-200">{active.region}</dd>
              <dt className="text-gray-400">District</dt><dd className="text-gray-700 dark:text-gray-200">{active.district}</dd>
              <dt className="text-gray-400">Council</dt><dd className="text-gray-700 dark:text-gray-200">{active.council}</dd>
              <dt className="text-gray-400">Ward</dt><dd className="text-gray-700 dark:text-gray-200">{active.ward}</dd>
              {active.street && (<><dt className="text-gray-400">Street</dt><dd className="text-gray-700 dark:text-gray-200">{active.street}</dd></>)}
              <dt className="text-gray-400">Coordinates</dt><dd className="font-mono text-xs text-gray-700 dark:text-gray-200">{Number(active.latitude).toFixed(6)}, {Number(active.longitude).toFixed(6)}</dd>
              {active.description && (<><dt className="text-gray-400">Notes</dt><dd className="text-gray-700 dark:text-gray-200">{active.description}</dd></>)}
              {active.global_id && (<><dt className="text-gray-400">Global ID</dt><dd className="font-mono text-[11px] text-gray-500 break-all">{active.global_id}</dd></>)}
            </dl>
            <div className="flex items-center gap-2 px-4 pb-4">
              <a href={`https://www.google.com/maps/search/?api=1&query=${active.latitude},${active.longitude}`} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Open in Google Maps</a>
              {canManage && <button type="button" onClick={() => removeOne(active)} className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">Delete point</button>}
            </div>
          </div>
        )}
      </section>

      {showImport && (
        <GeoImportModal projectId={projectId} regions={summary?.project_regions ?? []} onClose={() => setShowImport(false)} onImported={refreshAll} />
      )}

      <Modal isOpen={confirmAll} onClose={() => setConfirmAll(false)} title={`Delete ${list.total.toLocaleString()} point${list.total === 1 ? '' : 's'}?`} size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {filtered ? 'This deletes every point that matches the current search, layers and place filters.' : 'This deletes every map point of this project.'} It cannot be undone.
            You can upload the file again afterwards.
          </p>
          <label className="block text-xs text-gray-500">Type <b>{list.total}</b> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${sel} mt-1`} inputMode="numeric" aria-label="Confirm count" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmAll(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300">Cancel</button>
            <button type="button" disabled={typed.trim() !== String(list.total) || deleting} onClick={removeAllMatching}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-40">{deleting ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
