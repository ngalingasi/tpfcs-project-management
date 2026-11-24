import client from './client';

export interface GeoLayer { layer_id: number; name: string; color: string; count: number }
export interface GeoPlaceRow {
  region_id: number; region: string; district_id: number; district: string;
  council_id: number; council: string; ward_id: number; ward: string; count: number;
}
export interface GeoSummary {
  total: number;
  layers: GeoLayer[];
  places: GeoPlaceRow[];
  project_regions: { region_id: number; region_name: string }[];
}
/** [point_id, layer_id, latitude, longitude] */
export type GeoPin = [number, number, number, number];
export interface GeoPoint {
  point_id: number; project_id: number; layer_id: number; layer_name: string; layer_color: string;
  point_no: string | null; road_name: string | null; description: string | null; global_id: string | null;
  latitude: number | string; longitude: number | string; status: 'active' | 'inactive';
  region_id: number; region: string; district_id: number; district: string;
  council_id: number; council: string; ward_id: number; ward: string; street_id: number | null; street: string | null;
}
export interface GeoFilters {
  layer_ids?: string; region_id?: number | ''; district_id?: number | ''; council_id?: number | '';
  ward_id?: number | ''; q?: string; page?: number; limit?: number;
}
export interface GeoImportIssue { line: number; message: string }
export interface GeoImportResult {
  ok: boolean; dry_run: boolean; imported: boolean;
  summary: {
    rows: number; valid_rows: number; invalid_rows: number; to_insert: number; to_update: number;
    new_layers: string[]; new_places: { districts: number; councils: number; wards: number; streets: number };
    new_project_regions: string[]; error_total: number; warning_total: number;
  };
  errors: GeoImportIssue[];
  warnings: GeoImportIssue[];
  similar: { level: string; name: string; similar_to: string; parent: string; line: number }[];
}
export interface GeoImportOptions {
  file: File; dryRun: boolean; createMissing: boolean; linkRegions: boolean; skipInvalid: boolean;
}

const clean = (f: GeoFilters = {}) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null));

function saveBlob(blob: Blob, disposition: string | undefined, fallback: string) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = match?.[1] ?? fallback;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function download(path: string, params: object | undefined, fallback: string) {
  const r = await client.get(path, { responseType: 'blob', params });
  saveBlob(r.data, r.headers['content-disposition'], fallback);
}

export const geoApi = {
  summary: (pid: number) => client.get<GeoSummary>(`/projects/${pid}/geo/summary`),
  map: (pid: number, f?: GeoFilters) =>
    client.get<{ truncated: boolean; points: GeoPin[] }>(`/projects/${pid}/geo/map`, { params: clean(f) }),
  list: (pid: number, f?: GeoFilters) =>
    client.get<{ results: GeoPoint[]; page: number; limit: number; total: number; totalPages: number }>(`/projects/${pid}/geo/points`, { params: clean(f) }),
  get: (pid: number, pointId: number) => client.get<GeoPoint>(`/projects/${pid}/geo/points/${pointId}`),
  update: (pid: number, pointId: number, body: Partial<Pick<GeoPoint, 'point_no' | 'road_name' | 'description' | 'status' | 'layer_id'>> & { latitude?: number; longitude?: number }) =>
    client.patch<GeoPoint>(`/projects/${pid}/geo/points/${pointId}`, body),
  remove: (pid: number, pointId: number) => client.delete(`/projects/${pid}/geo/points/${pointId}`),
  removeMany: (pid: number, body: { ids: number[] } | { filters: GeoFilters; expected_count: number }) =>
    client.post<{ deleted: number }>(`/projects/${pid}/geo/points/delete`, body),
  importCsv: (pid: number, o: GeoImportOptions) => {
    const fd = new FormData();
    fd.append('file', o.file);
    fd.append('dry_run', String(o.dryRun));
    fd.append('create_missing', String(o.createMissing));
    fd.append('link_regions', String(o.linkRegions));
    fd.append('skip_invalid', String(o.skipInvalid));
    // 422 is a normal "needs fixing" outcome with a body we want to show
    return client.post<GeoImportResult>(`/projects/${pid}/geo/import`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000,
      validateStatus: (s) => s === 200 || s === 201 || s === 422,
    });
  },
  template: () => download('/projects/geo/template.csv', undefined, 'map_points_template.csv'),
  exportCsv: (pid: number, f?: GeoFilters) => download(`/projects/${pid}/geo/export.csv`, clean(f), `project_${pid}_map_points.csv`),
};
