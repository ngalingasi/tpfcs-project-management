import client from './client';
import type {
  Objective, Target, Activity, BudgetRevision,
  Document, UserRecord, Sector, Region, Implementer,
  PaginatedResponse, ProjectBudgetSummary, TargetBudgetSummary,
} from '../types';

export { authApi } from './auth';
export { projectsApi } from './projects';
export type { ProjectFilters } from './projects';

// ── Objectives ────────────────────────────────────────────────────────────────
export const objectivesApi = {
  listByProject: (projectId: number) =>
    client.get<Objective[]>(`/projects/${projectId}/objectives`),
  get: (id: number) =>
    client.get<Objective>(`/objectives/${id}`),
  create: (data: Partial<Objective>) =>
    client.post<Objective>(`/projects/${data.project_id}/objectives`, data),
  update: (id: number, data: Partial<Objective>) =>
    client.patch<Objective>(`/objectives/${id}`, data),
  delete: (id: number) =>
    client.delete(`/objectives/${id}`),
};

// ── Targets ───────────────────────────────────────────────────────────────────
export const targetsApi = {
  listByObjective: (objectiveId: number) =>
    client.get<Target[]>(`/objectives/${objectiveId}/targets`),
  get: (id: number) =>
    client.get<Target>(`/targets/${id}`),
  create: (data: Partial<Target>) =>
    client.post<Target>(`/objectives/${data.objective_id}/targets`, data),
  update: (id: number, data: Partial<Target>) =>
    client.patch<Target>(`/targets/${id}`, data),
  delete: (id: number) =>
    client.delete(`/targets/${id}`),
};

// ── Activities ────────────────────────────────────────────────────────────────
export interface ActivityFilters {
  page?: number;
  limit?: number;
  target_id?: number;
  region_id?: number;
  status?: string;
  assigned_user_id?: number;
}
export const activitiesApi = {
  list: (params?: ActivityFilters) =>
    client.get<PaginatedResponse<Activity>>('/activities', { params }),
  get: (id: number) =>
    client.get<Activity>(`/activities/${id}`),
  create: (data: Partial<Activity>) =>
    client.post<Activity>('/activities', data),
  update: (id: number, data: Partial<Activity>) =>
    client.patch<Activity>(`/activities/${id}`, data),
  delete: (id: number) =>
    client.delete(`/activities/${id}`),
  getHistory: (id: number) =>
    client.get(`/activities/${id}/history`),
  getStatuses: () =>
    client.get<{ statuses: string[]; transitions: Record<string, string[]> }>('/activities/meta/statuses'),
};

// ── Budget ────────────────────────────────────────────────────────────────────
export const budgetApi = {
  projectSummary: (projectId: number) =>
    client.get<ProjectBudgetSummary>(`/budget/projects/${projectId}/summary`),
  targetSummary: (targetId: number) =>
    client.get<TargetBudgetSummary>(`/budget/targets/${targetId}/summary`),
  allocateTarget: (targetId: number, amount: number) =>
    client.put(`/budget/targets/${targetId}/allocate`, { amount }),
  listRevisions: (params?: { status?: string; activity_id?: number }) =>
    client.get<BudgetRevision[]>('/budget/revisions', { params }),
  getRevision: (id: number) =>
    client.get<BudgetRevision>(`/budget/revisions/${id}`),
  requestRevision: (activityId: number, requested_amount: number, reason: string) =>
    client.post<BudgetRevision>(`/budget/activities/${activityId}/revisions`, { requested_amount, reason }),
  approveRevision: (id: number, review_notes?: string) =>
    client.put<BudgetRevision>(`/budget/revisions/${id}/approve`, { review_notes }),
  rejectRevision: (id: number, review_notes: string) =>
    client.put<BudgetRevision>(`/budget/revisions/${id}/reject`, { review_notes }),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsApi = {
  listByProject: (projectId: number) =>
    client.get<Document[]>(`/projects/${projectId}/documents`),
  get: (id: number) =>
    client.get<Document>(`/documents/${id}`),
  upload: (projectId: number, formData: FormData) =>
    client.post<Document>(`/projects/${projectId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadVersion: (documentId: number, formData: FormData) =>
    client.post<Document>(`/documents/${documentId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  downloadUrl: (documentId: number, version?: number) =>
    `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1'}/documents/${documentId}/download${version ? `/${version}` : ''}`,
  delete: (id: number) =>
    client.delete(`/documents/${id}`),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { page?: number; limit?: number; role?: string; status?: string; search?: string }) =>
    client.get<PaginatedResponse<UserRecord>>('/users', { params }),
  get: (id: number) =>
    client.get<UserRecord>(`/users/${id}`),
  create: (data: Partial<UserRecord> & { password?: string }) =>
    client.post<UserRecord>('/users', data),
  update: (id: number, data: Partial<UserRecord>) =>
    client.patch<UserRecord>(`/users/${id}`, data),
  delete: (id: number) =>
    client.delete(`/users/${id}`),
};

// ── Lookups ───────────────────────────────────────────────────────────────────
export const lookupsApi = {
  sectors: () => client.get<Sector[]>('/lookups/sectors'),
  createSector: (data: Partial<Sector>) => client.post<Sector>('/lookups/sectors', data),
  updateSector: (id: number, data: Partial<Sector>) => client.patch<Sector>(`/lookups/sectors/${id}`, data),
  deleteSector: (id: number) => client.delete(`/lookups/sectors/${id}`),

  regions: () => client.get<Region[]>('/lookups/regions'),
  createRegion: (data: Partial<Region>) => client.post<Region>('/lookups/regions', data),
  updateRegion: (id: number, data: Partial<Region>) => client.patch<Region>(`/lookups/regions/${id}`, data),
  deleteRegion: (id: number) => client.delete(`/lookups/regions/${id}`),

  implementers: () => client.get<Implementer[]>('/lookups/implementers'),
  createImplementer: (data: Partial<Implementer>) => client.post<Implementer>('/lookups/implementers', data),
  updateImplementer: (id: number, data: Partial<Implementer>) => client.patch<Implementer>(`/lookups/implementers/${id}`, data),
  deleteImplementer: (id: number) => client.delete(`/lookups/implementers/${id}`),
};
