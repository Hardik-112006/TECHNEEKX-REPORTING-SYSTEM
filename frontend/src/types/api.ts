export type TaskStatus =
  | 'Assigned'
  | 'In Progress'
  | 'Submitted'
  | 'Approved'
  | 'Changes Requested'
  | 'Cancelled'

export type RoleName =
  | 'Founder'
  | 'Chairman'
  | 'Managing Director'
  | 'President'
  | 'Official'
  | 'Director of Core Operations'
  | 'Core Team Lead'
  | 'Core Lead'
  | 'Member'

export interface DemoAccount {
  email: string
  name: string
  label: string
  role: RoleName | string
  position?: string | null
  group_id?: number | null
  group_name?: string | null
  team_name?: string | null
  tier: number
  hierarchy_level: number
  category: 'Founder' | 'Officials' | 'Director of Core Operations' | 'Core Leads' | 'Members' | string
  description: string
}

export type DemoUserOption = DemoAccount


export interface Role {
  role_id: number
  name: RoleName | string
  description?: string
}

export interface UserSummary {
  user_id: number
  name: string
  email: string
  role?: Role | null
  role_name?: string
  team_id?: number | null
  team_name?: string | null
  group_id?: number | null
  group_name?: string | null
  status?: string
  position?: string | null
  role_tier?: number
  hierarchy_level?: number
  category?: 'Founder' | 'Officials' | 'Director of Core Operations' | 'Core Leads' | 'Members' | 'Official Team' | 'Board' | 'Core Team' | string
}

export interface UserDetail extends UserSummary {
  phone?: string
  bio?: string
  created_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface AuthResponse {
  message?: string
  user: UserDetail
  tokens: AuthTokens
}

export interface TeamSummary {
  team_id: number
  name: string
  type: 'Core' | 'Group' | string
  description?: string
  parent_team?: number | null
  parent_team_name?: string | null
  member_count: number
}

export interface Group {
  group_id: number
  name: string
  team: number
  team_name?: string
  description?: string
  created_at: string
}

export interface TeamDetail extends TeamSummary {
  members: UserSummary[]
  groups: Group[]
  sub_teams: TeamSummary[]
}

export interface TaskProof {
  proof_id: number
  task_id: number
  task_title?: string
  task_status?: string
  submitted_by: UserSummary
  github_link?: string
  screenshots?: string
  description?: string
  submitted_at: string
}

export interface Review {
  review_id: number
  task_id: number
  task_title?: string
  proof_id?: number | null
  reviewer: UserSummary
  decision: 'Approved' | 'Changes Requested'
  feedback: string
  reviewed_at: string
}

export interface Task {
  task_id: number
  title: string
  description: string
  deadline: string
  deadline_display?: string
  is_overdue?: boolean
  assigned_to?: UserSummary | null
  team?: TeamSummary | null
  team_name?: string | null
  group?: number | null
  group_name?: string | null
  parent_task?: number | null
  parent_task_title?: string | null
  subtasks_count?: number
  created_by: UserSummary
  status: TaskStatus
  priority?: 'Low' | 'Medium' | 'High' | 'Critical' | string
  created_at: string
  proof_count?: number
  proofs_count?: number
  latest_proof?: TaskProof
}

export interface TaskCreatePayload {
  title: string
  description: string
  deadline: string
  assigned_to?: number | null
  assigned_to_id?: number | null
  team?: number | null
  team_id?: number | null
  group_id?: number | null
  parent_task_id?: number | null
  priority?: string
}

export interface WarningAuditLog {
  audit_id: number
  warning_id: number
  action: string
  actor?: number | null
  actor_name?: string | null
  details: string
  created_at: string
}

export interface BoardWarning {
  warning_id: number
  target_user?: number | null
  target_user_name?: string | null
  target_group?: number | null
  target_group_name?: string | null
  related_task?: number | null
  task_title?: string | null
  original_deadline?: string | null
  category?: string | null
  reason: string
  issued_by: number
  issued_by_name: string
  status: 'Active' | 'Acknowledged' | 'Resolved' | 'Expired'
  expiry_date?: string | null
  revised_deadline?: string | null
  revised_deadline_by?: number | null
  revised_deadline_by_name?: string | null
  revised_deadline_at?: string | null
  resolved_at?: string | null
  resolved_by?: number | null
  resolved_by_name?: string | null
  created_at: string
  audit_logs?: WarningAuditLog[]
}

export interface RemovalReview {
  review_id: number
  target_user?: number | null
  target_user_name?: string | null
  target_group?: number | null
  target_group_name?: string | null
  reason: string
  flagged_by: number
  flagged_by_name: string
  status: 'Pending' | 'Approved_Deactivated' | 'Rejected'
  official_notes?: string
  resolved_by?: number | null
  resolved_by_name?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface BoardMonitoringMetrics {
  total_overdue: number
  total_awaiting_review: number
  total_missing_reports: number
  total_active_warnings: number
  total_warning_history?: number
  total_pending_removals: number
  group_statistics: Array<{
    group_id: number
    name: string
    members_count: number
    total_tasks: number
    completed_tasks: number
    overdue_tasks: number
    completion_rate: number
  }>
  recent_overdue_tasks: Array<{
    task_id: number
    title: string
    assigned_to: string
    group: string
    deadline: string | null
    status: string
  }>
  recent_warnings: Array<{
    warning_id: number
    target: string
    target_user_id?: number | null
    reason: string
    issued_by: string
    created_at: string
    status: string
  }>
  pending_removal_reviews: Array<{
    review_id: number
    target: string
    target_user_id?: number | null
    reason: string
    flagged_by: string
    created_at: string
    status: string
  }>
}

export interface ProofSubmitPayload {
  github_link?: string
  screenshots?: string
  description?: string
}

export interface ReviewCreatePayload {
  decision: 'Approved' | 'Changes Requested'
  feedback: string
}

export interface Performance {
  performance_id: number
  user: UserSummary
  points: number
  tasks_completed: number
  rank: number
  updated_at: string
}

export interface Announcement {
  announcement_id: number
  title: string
  content: string
  category?: string
  attachment?: string | null
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_type?: string | null
  external_link?: string | null
  drive_link?: string | null
  created_by: UserSummary
  created_at: string
  target_role?: string
}

export interface HistoryLog {
  log_id: number
  user: UserSummary
  action: string
  details: string
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  message: string
  errors?: Record<string, string | string[]>
  status?: number
}

// -------------------------------------------------------------
// POST-MVP: Phase 1 — Career Profiles & ATS Resume Builder
// -------------------------------------------------------------

export interface Education {
  id: number
  institution: string
  degree: string
  field_of_study: string
  graduation_year: number
  grade?: string
  description?: string
}

export interface PortfolioProject {
  id: number
  title: string
  description: string
  technologies: string
  github_link?: string
  live_url?: string
  is_featured: boolean
  include_in_resume: boolean
  order: number
}

export interface Achievement {
  id: number
  title: string
  issuer: string
  issue_date?: string | null
  credential_url?: string
  description?: string
  include_in_resume: boolean
}

export interface ContributionHighlight {
  id: number
  task?: number | null
  title: string
  description: string
  points_earned: number
  verified_at: string
  include_in_resume: boolean
}

export interface ResumeConfiguration {
  id: number
  template_style: string
  custom_headline?: string
  include_summary: boolean
  include_education: boolean
  include_projects: boolean
  include_skills: boolean
  include_achievements: boolean
  include_community_contributions: boolean
}

export interface CareerProfile {
  id: number
  user_id: number
  user_name: string
  user_email: string
  headline: string
  target_role: string
  target_company: string
  experience_years: string | number
  bio: string
  skills: string[]
  phone: string
  linkedin_url: string
  github_url: string
  portfolio_url: string
  location: string
  visibility: 'Public' | 'Community' | 'Private'
  shareable_slug: string
  educations: Education[]
  projects: PortfolioProject[]
  achievements: Achievement[]
  contributions: ContributionHighlight[]
  resume_config?: ResumeConfiguration
  created_at: string
  updated_at: string
}

export interface PublicCareerProfile {
  user_name: string
  headline: string
  target_role: string
  target_company: string
  bio: string
  skills: string[]
  linkedin_url: string
  github_url: string
  portfolio_url: string
  location: string
  educations: Education[]
  projects: PortfolioProject[]
  achievements: Achievement[]
  contributions: ContributionHighlight[]
}

// -------------------------------------------------------------
// POST-MVP: Phase 2 & 3 — Hackathons, Certificates & Recruitment
// -------------------------------------------------------------

export interface Hackathon {
  id: number
  title: string
  slug: string
  tagline: string
  description: string
  theme: string
  banner_url?: string
  registration_start: string
  registration_end: string
  start_date: string
  end_date: string
  min_team_size: number
  max_team_size: number
  allow_external_participants: boolean
  is_active: boolean
  scoring_rules?: Record<string, number>
  participants_count?: number
  teams_count?: number
  is_registration_open?: boolean
  created_at: string
}

export interface Participant {
  id: number
  hackathon: number
  user?: number | null
  user_name?: string
  user_email?: string
  full_name: string
  email: string
  phone?: string
  college_or_org?: string
  is_external: boolean
  status: 'Registered' | 'Confirmed' | 'Submitted' | 'Disqualified' | 'Completed'
  registered_at: string
}

export interface HackathonTeamMember {
  id: number
  participant: number
  participant_name: string
  participant_email: string
  role_in_team: string
  joined_at: string
}

export interface HackathonTeam {
  id: number
  hackathon: number
  team_name: string
  leader: number
  leader_name: string
  leader_email: string
  project_title?: string
  project_repo?: string
  project_demo?: string
  submission_notes?: string
  members?: HackathonTeamMember[]
  member_count?: number
  created_at: string
}

export interface CertificateSubmission {
  id: number
  hackathon: number
  hackathon_title?: string
  participant: number
  participant_name?: string
  participant_email?: string
  team?: number | null
  category: '1st' | '2nd' | '3rd' | 'Top 10' | 'Special Mention' | 'Participation'
  certificate_url: string
  verification_status: 'Pending' | 'Approved' | 'Rejected'
  reviewer?: number | null
  reviewer_name?: string | null
  reviewed_at?: string | null
  reviewer_feedback?: string
  points_awarded: number
  is_reward_granted: boolean
  submitted_at: string
}

export interface HackathonRanking {
  id: number
  hackathon: number
  hackathon_title?: string
  participant: number
  participant_name: string
  participant_email: string
  team?: number | null
  team_name?: string
  rank_position: number
  hackathon_points: number
  is_verified: boolean
  tie_break_score: number
  notes?: string
  created_at: string
}

export interface CandidateShortlist {
  id: number
  hackathon: number
  participant: number
  participant_name: string
  participant_email: string
  team?: number | null
  team_name?: string
  decision: 'Under Review' | 'Accepted' | 'Rejected' | 'On Hold'
  reviewer?: number | null
  reviewer_name?: string | null
  decision_reason?: string
  offered_role?: string
  reviewed_at?: string | null
  created_at: string
}

export interface RecruitmentAnalytics {
  hackathon_title: string
  total_participants: number
  total_teams: number
  certificates_submitted: number
  certificates_verified: number
  total_shortlisted: number
  total_accepted: number
  total_rejected: number
  total_under_review: number
  conversion_rate_percent: number
}

// -------------------------------------------------------------
// POST-MVP: Phase 4 — Official Documents & Partnerships
// -------------------------------------------------------------

export interface ResourceMaterial {
  id: number
  title: string
  category: 'Guide' | 'Template' | 'Cheatsheet' | 'Brand Asset' | 'Tool'
  description?: string
  file_url: string
  min_role_tier: number
  download_count: number
  uploaded_by?: number | null
  uploaded_by_name?: string
  created_at: string
  updated_at: string
}

export interface MouDocument {
  id: number
  organization_name: string
  signatory_first_party: string
  signatory_second_party: string
  scope_of_work: string
  validity_start: string
  validity_end: string
  status: 'Draft' | 'In Review' | 'Approved' | 'Signed' | 'Terminated'
  review_notes?: string
  created_by?: number
  created_by_name?: string
  approved_by?: number | null
  approved_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface EventProposal {
  id: number
  title: string
  event_type: string
  target_date: string
  expected_attendees: number
  estimated_budget: string | number
  venue_or_platform: string
  description: string
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected'
  reviewer_feedback?: string
  submitted_by?: number
  submitted_by_name?: string
  reviewed_by?: number | null
  reviewed_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface SponsorshipProposal {
  id: number
  sponsor_organization: string
  sponsorship_tier: 'Title' | 'Platinum' | 'Gold' | 'Silver' | 'Community'
  amount_requested: string | number
  contact_person: string
  contact_email: string
  deliverables_offered: string
  status: 'Draft' | 'Proposed' | 'Negotiating' | 'Signed' | 'Declined'
  notes?: string
  handled_by?: number
  handled_by_name?: string
  created_at: string
  updated_at: string
}

export interface CommunityPartner {
  id: number
  organization_name: string
  partner_type: 'College Club' | 'Tech Community' | 'Corporate' | 'Media Partner' | 'Incubator'
  website?: string
  poc_name: string
  poc_email: string
  benefits_summary: string
  status: 'Active' | 'Pending' | 'Inactive'
  created_by?: number
  created_by_name?: string
  created_at: string
  updated_at: string
}

// -------------------------------------------------------------
// POST-MVP: Phase 5 — Advanced Analytics & Report Exports
// -------------------------------------------------------------

export interface AnalyticsSummary {
  total_tasks: number
  approved_tasks: number
  in_progress_tasks: number
  submitted_tasks: number
  assigned_tasks: number
  changes_requested_tasks: number
  completion_rate_percent: number
  overdue_tasks_count: number
  pending_reviews_count: number
  date_range: {
    start_date: string
    end_date: string
    days: number | string
  }
}

export interface CompletionTrendPoint {
  date: string
  created: number
  completed: number
}

export interface TeamPerformanceMetric {
  team_id: number
  name: string
  total_tasks: number
  approved_tasks: number
  overdue_tasks: number
  completion_rate_percent: number
  members_count: number
}

export interface MemberContributionMetric {
  user_id: number
  name: string
  email: string
  role: string
  total_points: number
  tasks_assigned: number
  tasks_approved: number
  approval_rate_percent: number
}

export interface UrgentPendingItem {
  task_id: number
  title: string
  team_name: string
  assigned_name: string
  submitted_at: string
  age_hours: number
  priority: 'Urgent' | 'Normal'
}

export interface PendingAnalysis {
  total_pending: number
  under_24h: number
  from_24_to_48h: number
  over_48h: number
  urgent_items: UrgentPendingItem[]
}

export interface HackathonAnalyticsData {
  total_hackathons: number
  total_participants: number
  certificates: {
    submitted: number
    verified: number
    rejected: number
    pending: number
  }
  recruitment: {
    total_shortlisted: number
    accepted: number
    rejected: number
    under_review: number
    conversion_rate_percent: number
  }
}

export interface AnalyticsOverview {
  summary: AnalyticsSummary
  trends: CompletionTrendPoint[]
  team_performance: TeamPerformanceMetric[]
  member_contributions: MemberContributionMetric[]
  pending_analysis: PendingAnalysis
  hackathon_analytics: HackathonAnalyticsData
}

// -------------------------------------------------------------
// POST-MVP: Phase 6 — Automated Reminders & Escalations
// -------------------------------------------------------------

export interface NotificationItem {
  notification_id: number
  title: string
  message: string
  notification_type: 'DEADLINE_APPROACHING' | 'TASK_OVERDUE' | 'PENDING_REVIEW' | 'ESCALATION' | 'SYSTEM'
  severity: 'info' | 'warning' | 'critical'
  is_read: boolean
  action_url?: string
  related_task_id?: number | null
  created_at: string
}

export interface NotificationSummary {
  unread_count: number
  recent: NotificationItem[]
}

// -------------------------------------------------------------
// POST-MVP: Phase 7 — Multi-Level Approval Workflows
// -------------------------------------------------------------

export interface ApprovalStageAudit {
  audit_id: number
  stage_number: number
  stage_name: string
  reviewer: number
  reviewer_name: string
  reviewer_role: string
  decision: 'Approved' | 'Changes Requested' | 'Rejected'
  feedback: string
  decided_at: string
}

export interface ApprovalWorkflow {
  workflow_id: number
  content_type: string
  object_id: number
  title: string
  description: string
  submitter: number
  submitter_name: string
  current_stage: number
  total_stages: number
  status: 'Pending Stage 1' | 'Pending Stage 2' | 'Approved' | 'Changes Requested' | 'Rejected'
  stage_history: ApprovalStageAudit[]
  created_at: string
  updated_at: string
}

// -------------------------------------------------------------
// Global Search & Live ETA Types
// -------------------------------------------------------------

export interface SearchItem {
  id: number
  title: string
  subtitle: string
  status?: string
  type?: string
  email?: string
  task_id?: number
  target_nav: string
}

export interface SearchResults {
  query: string
  total_results: number
  results: {
    tasks: SearchItem[]
    teams: SearchItem[]
    members: SearchItem[]
    announcements: SearchItem[]
    submissions: SearchItem[]
  }
}

export interface UpcomingEtaItem {
  task_id: number
  title: string
  status: string
  deadline: string
  formatted_eta: string
  is_overdue: boolean
}

export interface LiveEtaResponse {
  has_eta: boolean
  formatted_eta: string
  task_id?: number
  task_title?: string
  status?: string
  deadline?: string
  is_overdue?: boolean
  context?: string
  last_updated?: string
  message?: string
  upcoming?: UpcomingEtaItem[]
}



