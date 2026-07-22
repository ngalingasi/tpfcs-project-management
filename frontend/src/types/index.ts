// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  user_id: number;
  full_name: string;
  username: string;
  email: string;
  mobile?: string;
  gender?: string;
  avatar?: string | null;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive';
  must_change_password: number;
}

export interface TokenPair {
  token: string;
  expires: string;
}

export interface AuthTokens {
  access: TokenPair;
  refresh: TokenPair;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface OtpChannel {
  type: 'email' | 'sms';
  display: string;
  label: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

// ── Lookup ────────────────────────────────────────────────────────────────────
export interface Sector {
  sector_id: number;
  name: string;
  parent_sector_id?: number | null;
}

export interface Region {
  region_id: number;
  region_name: string;
}

export interface Implementer {
  implementer_id: number;
  name: string;
  description?: string;
}

// ── Project ───────────────────────────────────────────────────────────────────
export interface ProjectFinancing {
  _key?: string;
  financing_id?: number;
  project_id?: number;
  fund_source?: string;
  financial_modality?: string;
  financial_category?: string;
  financier?: string;
  committed_amount?: number;
  exchange_rate?: number;
  currency?: string;
  amount_tzs?: number;
}

export interface ProjectCoordinator {
  _key?: string;
  coordinator_id?: number;
  project_id?: number;
  full_name: string;
  email?: string;
  phone_number?: string;
  address?: string;
}

export interface ProjectEmployment {
  _key?: string;
  employment_id?: number;
  project_id?: number;
  category: string;
  type: string;
  foreign_count: number;
  domestic_count: number;
}

export interface Project {
  project_id: number;
  name: string;
  programme_name?: string;
  project_nature?: string;
  sector_id?: number | null;
  sector_name?: string;
  sub_sector?: string;
  start_date?: string;
  end_date?: string;
  // Financing
  fund_structure?: string;
  funding?: string;
  estimated_cost?: number;
  project_life_span?: number;
  // Narrative
  project_background?: string;
  project_objectives?: string;        // comma-separated, displayed as bullets
  project_main_activities?: string;   // comma-separated, displayed as bullets
  project_beneficiaries?: string;     // comma-separated, displayed as bullets
  project_use_capacity?: string;
  project_scope?: string;
  // Admin
  cost_center?: string;
  project_reference?: string;
  relevancy_fypds?: string;
  implementation_modality?: string;
  compensation?: string;
  has_land?: number;
  job_created_no?: string;
  project_manager_id?: number | null;
  project_manager_name?: string;
  created_at: string;
  // Relations
  regions?: Region[];
  implementers?: ProjectImplementer[];
  financing?: ProjectFinancing[];
  coordinators?: ProjectCoordinator[];
  employment?: ProjectEmployment[];
  objectives?: Objective[];
  sites?: ProjectSite[];
}

// ── Project Site ──────────────────────────────────────────────────────────────
export interface ProjectSite {
  site_id: number;
  project_id: number;
  region_id?: number | null;
  region_name?: string;
  objective_id?: number | null;
  objective_title?: string;
  objective_status?: string;
  site_name: string;
  district?: string | null;
  ward?: string | null;
  street?: string | null;
  road_name?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: 'planned' | 'active' | 'completed' | 'on_hold';
  created_at: string;
}

export interface ProjectImplementer {
  implementer_id: number;
  name: string;
  vote_name?: string;
  vote_code?: string;
  sub_vote_code?: string;
  sub_vote_name?: string;
  cost_center?: string;
  involvement?: string;
  link_id?: number;
}

// ── Objective ─────────────────────────────────────────────────────────────────
export interface Objective {
  objective_id: number;
  project_id: number;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  target_count?: number;
  targets?: Target[];
  created_at: string;
}

// ── Target ────────────────────────────────────────────────────────────────────
export interface Target {
  target_id: number;
  objective_id: number;
  target_name?: string;
  name: string;
  metric_type: 'count' | 'percentage' | 'amount' | 'other';
  unit?: string;
  target_value: number;
  current_value: number;
  allocated_budget: number;
  spent_amount: number;
  deadline?: string;
  status: 'on_track' | 'at_risk' | 'off_track' | 'achieved' | 'missed';
  created_at: string;
}

// ── Activity ──────────────────────────────────────────────────────────────────
export type ActivityStatus = 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'overdue';

export interface Activity {
  activity_id: number;
  main_activity_id?: number | null;
  global_id?: string | null;
  target_id: number;
  target_name?: string;
  region_id?: number;
  region_name?: string;
  name: string;
  description?: string;
  council?: string;
  ward?: string;
  street?: string;
  road_name?: string;
  latitude?: number;
  longitude?: number;
  assigned_user_id?: number;
  assigned_user_name?: string;
  supervisor_id?: number;
  supervisor_name?: string;
  start_date?: string;
  end_date?: string;
  progress: number;
  budgeted_amount: number;
  revised_amount?: number;
  effective_budget: number;
  spent_amount: number;
  status: ActivityStatus;
  created_at: string;
}

export interface ActivityStatusHistory {
  id: number;
  activity_id: number;
  old_status: ActivityStatus;
  new_status: ActivityStatus;
  changed_by: number;
  changed_by_name: string;
  changed_at: string;
}

// ── Budget ────────────────────────────────────────────────────────────────────
export interface ProjectBudgetSummary {
  project_id: number;
  project_name: string;
  total_budget: number;
  allocated_to_targets: number;
  unallocated_budget: number;
  total_spent: number;
  remaining_budget: number;
  spent_percentage: number;
}

export interface TargetBudgetSummary {
  target_id: number;
  target_name: string;
  allocated_budget: number;
  committed_to_activities: number;
  available_budget: number;
  total_spent: number;
  spent_percentage: number;
}

export interface BudgetRevision {
  revision_id: number;
  activity_id: number;
  activity_name: string;
  requested_by: number;
  requested_by_name: string;
  current_amount: number;
  requested_amount: number;
  difference: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: number;
  reviewed_by_name?: string;
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
}

// ── Document ──────────────────────────────────────────────────────────────────
export interface Document {
  document_id: number;
  project_id?: number;
  activity_id?: number;
  name: string;
  file_path?: string;
  mime_type?: string;
  size?: number;
  version_number?: number;
  uploaded_at?: string;
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  id: number;
  document_id: number;
  file_path: string;
  mime_type: string;
  size: number;
  version_number: number;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
}

// ── User ──────────────────────────────────────────────────────────────────────
export interface UserRecord {
  user_id: number;
  full_name: string;
  username: string;
  email?: string;
  mobile?: string;
  gender?: string;
  avatar?: string | null;
  role: string;
  status: string;
  must_change_password: number;
  created_at: string;
}

// ── API Error ─────────────────────────────────────────────────────────────────
export interface ApiErrorResponse {
  code: number;
  message: string;
}
