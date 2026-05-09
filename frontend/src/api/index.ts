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
  getSubActivities: (id: number) =>
    client.get(`/activities/${id}/sub-activities`),
  createSubActivity: (id: number, data: any) =>
    client.post(`/activities/${id}/sub-activities`, data),
  getDocuments: (id: number) =>
    client.get(`/activities/${id}/documents`),
  uploadDocument: (id: number, formData: FormData) =>
    client.post(`/activities/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getComments: (id: number) =>
    client.get(`/activities/${id}/comments`),
  addComment: (id: number, comment: string) =>
    client.post(`/activities/${id}/comments`, { comment }),
  deleteComment: (activityId: number, commentId: number) =>
    client.delete(`/activities/${activityId}/comments/${commentId}`),
  getPayments: (id: number) =>
    client.get(`/activities/${id}/payments`),
  getPaymentSummary: (id: number) =>
    client.get(`/activities/${id}/payments/summary`),
  createPayment: (id: number, data: FormData) =>
    client.post(`/activities/${id}/payments`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updatePaymentStatus: (activityId: number, paymentId: number, status: string) =>
    client.patch(`/activities/${activityId}/payments/${paymentId}/status`, { status }),
  deletePayment: (activityId: number, paymentId: number) =>
    client.delete(`/activities/${activityId}/payments/${paymentId}`),
  getStatuses: () =>
    client.get<{ statuses: string[]; transitions: Record<string, string[]> }>('/activities/meta/statuses'),
};

// ── Budget ────────────────────────────────────────────────────────────────────
export const financialApi = {
  summary: (projectId?: number) =>
    client.get('/financial/summary', { params: projectId ? { project_id: projectId } : {} }),
};

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
  getSkills: () =>
    client.get('/users/meta/skills'),
  updateSkills: (id: number, skill_ids: number[]) =>
    client.put(`/users/${id}/skills`, { skill_ids }),
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

// ── Inventory API ─────────────────────────────────────────────────────────────
export const suppliersApi = {
  list:   (params?: any) => client.get('/inventory/suppliers', { params }),
  get:    (id: number)   => client.get(`/inventory/suppliers/${id}`),
  create: (data: any)    => client.post('/inventory/suppliers', data),
  update: (id: number, data: any) => client.patch(`/inventory/suppliers/${id}`, data),
  delete: (id: number)   => client.delete(`/inventory/suppliers/${id}`),
};

export const productsApi = {
  list:          (params?: any)       => client.get('/inventory/products', { params }),
  get:           (id: number)         => client.get(`/inventory/products/${id}`),
  getCategories: (product_type?: string) => client.get('/inventory/products/meta/categories', { params: product_type ? { product_type } : {} }),
  create:        (data: any)          => client.post('/inventory/products', data),
  update:        (id: number, data: any) => client.patch(`/inventory/products/${id}`, data),
  delete:        (id: number)         => client.delete(`/inventory/products/${id}`),
};

export const storesApi = {
  list:   (params?: any) => client.get('/inventory/stores', { params }),
  get:    (id: number)   => client.get(`/inventory/stores/${id}`),
  create: (data: any)    => client.post('/inventory/stores', data),
  update: (id: number, data: any) => client.patch(`/inventory/stores/${id}`, data),
  delete: (id: number)   => client.delete(`/inventory/stores/${id}`),
};

// ── Purchase Orders API ───────────────────────────────────────────────────────
export const purchaseOrdersApi = {
  list:   (params?: any) => client.get('/purchase-orders', { params }),
  get:    (id: number)   => client.get(`/purchase-orders/${id}`),
  create: (data: any)    => client.post('/purchase-orders', data),
  update: (id: number, data: any) => client.put(`/purchase-orders/${id}`, data),
  cancel: (id: number)   => client.post(`/purchase-orders/${id}/cancel`),
  delete: (id: number)   => client.delete(`/purchase-orders/${id}`),
};

// ── Inspection API ────────────────────────────────────────────────────────────
export const inspectionApi = {
  // Checklists
  listChecklists:  (params?: any) => client.get('/inspection/checklists', { params }),
  getChecklist:    (id: number)   => client.get(`/inspection/checklists/${id}`),
  createChecklist: (data: any)    => client.post('/inspection/checklists', data),
  updateChecklist: (id: number, data: any) => client.put(`/inspection/checklists/${id}`, data),
  deleteChecklist: (id: number)   => client.delete(`/inspection/checklists/${id}`),
  // Requests
  listRequests:    (params?: any) => client.get('/inspection/requests', { params }),
  getRequest:      (id: number)   => client.get(`/inspection/requests/${id}`),
  createRequest:   (data: any)    => client.post('/inspection/requests', data),
  updateRequest:   (id: number, data: any) => client.put(`/inspection/requests/${id}`, data),
  cancelRequest:   (id: number)   => client.post(`/inspection/requests/${id}/cancel`),
  deleteRequest:   (id: number)   => client.delete(`/inspection/requests/${id}`),
  // Assignments
  acceptAssignment:   (id: number, remarks?: string) => client.post(`/inspection/assignments/${id}/accept`, { remarks }),
  rejectAssignment:   (id: number, remarks: string)  => client.post(`/inspection/assignments/${id}/reject`, { remarks }),
  getEvidence:        (assignmentId: number)          => client.get(`/inspection/assignments/${assignmentId}/evidence`),
  uploadEvidence:     (assignmentId: number, formData: FormData) =>
    client.post(`/inspection/assignments/${assignmentId}/evidence`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Execution
  getExecutionData:   (id: number) => client.get(`/inspection/requests/${id}/execute`),
  saveResponses:      (id: number, data: FormData) =>
    client.post(`/inspection/requests/${id}/responses`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  submitInspection:   (id: number, data: any) => client.post(`/inspection/requests/${id}/submit`, data),
  // Approval
  approveInspection:  (id: number, data: any) => client.post(`/inspection/requests/${id}/approve`, data),
  rejectApproval:     (id: number, data: any) => client.post(`/inspection/requests/${id}/reject-approval`, data),
  // Stock
  getStoreStock:      (storeId: number) => client.get(`/inspection/stock/${storeId}`),
  getStockTransactions:(params?: any)   => client.get('/inspection/stock-transactions', { params }),
};
