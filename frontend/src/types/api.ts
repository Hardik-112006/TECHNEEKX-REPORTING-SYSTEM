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
  | 'CTO'
  | 'Director of Core Operations'
  | 'Mentor'
  | 'Core Team Lead'
  | 'Deputy'
  | 'Group Leader'
  | 'Member'

export interface DemoUserOption {
  email: string
  label: string
  role: RoleName | string
  tier: number
  description: string
}

export const DEMO_USERS: DemoUserOption[] = [
  {
    email: 'founder@example.com',
    label: 'Demo Founder',
    role: 'Founder',
    tier: 1,
    description: 'Tier 1 Executive: Full platform oversight, team creation, user management'
  },
  {
    email: 'official@example.com',
    label: 'Demo Official',
    role: 'Official',
    tier: 2,
    description: 'Tier 2 Official: Org-wide review privileges, team management'
  },
  {
    email: 'aarav.lead@example.com',
    label: 'Aarav (Core Lead)',
    role: 'Core Team Lead',
    tier: 3,
    description: 'Tier 3 Core Lead: Create tasks, assign members, review team tasks'
  },
  {
    email: 'meera.leader@example.com',
    label: 'Meera (Group Leader)',
    role: 'Group Leader',
    tier: 4,
    description: 'Tier 4 Leader: Conduct reviews, manage group assignments'
  },
  {
    email: 'riya.member@example.com',
    label: 'Riya (Member)',
    role: 'Member',
    tier: 5,
    description: 'Tier 5 Member: Execute assigned tasks, submit proofs, view feedback'
  },
  {
    email: 'kabir.member@example.com',
    label: 'Kabir (Member)',
    role: 'Member',
    tier: 5,
    description: 'Tier 5 Member: Complete tasks, earn points, track rank'
  }
]

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
  status?: string
}

export interface UserDetail extends UserSummary {
  role_tier: number
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
  assigned_to?: UserSummary | null
  team?: TeamSummary | null
  created_by: UserSummary
  status: TaskStatus
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | string
  created_at: string
  proof_count: number
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
  priority?: string
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
