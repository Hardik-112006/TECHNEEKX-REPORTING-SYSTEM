import type {
  AuthResponse,
  UserDetail,
  DemoAccount,
  Task,
  TaskCreatePayload,
  ProofSubmitPayload,
  ReviewCreatePayload,
  TaskProof,
  Review,
  TeamSummary,
  TeamDetail,
  Group,
  Performance,
  Announcement,
  HistoryLog,
  PaginatedResponse,
  Role,
  UserSummary,
  ApiError,
  CareerProfile,
  Education,
  PortfolioProject,
  Achievement,
  ContributionHighlight,
  ResumeConfiguration,
  PublicCareerProfile,
  Hackathon,
  Participant,
  HackathonTeam,
  CertificateSubmission,
  HackathonRanking,
  CandidateShortlist,
  RecruitmentAnalytics,
  ResourceMaterial,
  MouDocument,
  EventProposal,
  SponsorshipProposal,
  CommunityPartner,
  AnalyticsOverview,
  NotificationItem,
  NotificationSummary,
  ApprovalWorkflow,
  BoardWarning,
  WarningAuditLog,
  RemovalReview,
  BoardMonitoringMetrics,
  SearchResults,
  LiveEtaResponse,
  TaskProgressNote
} from '../types/api'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '')

const TOKEN_KEY_ACCESS = 'techneekx_access_token'
const TOKEN_KEY_REFRESH = 'techneekx_refresh_token'

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY_ACCESS)
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEY_REFRESH)
}

export function storeTokens(access: string, refresh?: string): void {
  localStorage.setItem(TOKEN_KEY_ACCESS, access)
  if (refresh) {
    localStorage.setItem(TOKEN_KEY_REFRESH, refresh)
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY_ACCESS)
  localStorage.removeItem(TOKEN_KEY_REFRESH)
}

let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const url = `${API_BASE_URL}/${endpoint.replace(/^\/+/, '')}`
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getStoredAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network error'
    throw {
      message: `Unable to connect to TechNeekX server (${errorMsg}). Please ensure backend is running.`,
      status: 0
    } as ApiError
  }

  // Handle Token Expiration and Refresh (HTTP 401)
  if (response.status === 401 && !isRetry && !endpoint.includes('auth/login') && !endpoint.includes('auth/refresh')) {
    const refreshToken = getStoredRefreshToken()
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken })
          })

          if (refreshRes.ok) {
            const data = await refreshRes.json()
            const newAccess = data.access
            storeTokens(newAccess)
            isRefreshing = false
            onRefreshed(newAccess)
            return request<T>(endpoint, options, true)
          } else {
            clearTokens()
            isRefreshing = false
            window.dispatchEvent(new CustomEvent('auth:expired'))
          }
        } catch {
          clearTokens()
          isRefreshing = false
          window.dispatchEvent(new CustomEvent('auth:expired'))
        }
      } else {
        // Wait for token refresh to finish
        return new Promise<T>((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            headers.set('Authorization', `Bearer ${newToken}`)
            resolve(request<T>(endpoint, { ...options, headers }, true))
          })
        })
      }
    }
  }

  // Handle No Content (204)
  if (response.status === 204) {
    return {} as T
  }

  let data: any
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    let message = 'An unexpected server error occurred.'
    if (data) {
      if (typeof data.error === 'string') {
        message = data.error
      } else if (typeof data.detail === 'string') {
        message = data.detail
      } else if (Array.isArray(data.non_field_errors)) {
        message = data.non_field_errors.join(' ')
      } else if (typeof data === 'object') {
        const firstKey = Object.keys(data)[0]
        if (firstKey) {
          const val = data[firstKey]
          message = Array.isArray(val) ? `${firstKey}: ${val.join(', ')}` : `${firstKey}: ${val}`
        }
      }
    }

    const errorPayload: ApiError = {
      message,
      errors: typeof data === 'object' && data !== null ? data : undefined,
      status: response.status
    }
    throw errorPayload
  }

  return data as T
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------
export const authApi = {
  async login(credentials: { email: string; password: string }): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
    storeTokens(res.tokens.access, res.tokens.refresh)
    return res
  },

  async register(data: { name: string; email: string; password: string }): Promise<{ message: string; user: UserSummary }> {
    return request<{ message: string; user: UserSummary }>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async logout(): Promise<void> {
    const refresh = getStoredRefreshToken()
    try {
      if (refresh) {
        await request('/auth/logout/', {
          method: 'POST',
          body: JSON.stringify({ refresh })
        })
      }
    } finally {
      clearTokens()
    }
  },

  async getMe(): Promise<UserDetail> {
    return request<UserDetail>('/auth/me/')
  },

  async updateMe(data: Partial<UserDetail>): Promise<{ message: string; user: UserDetail }> {
    return request<{ message: string; user: UserDetail }>('/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  async getRoles(): Promise<Role[]> {
    return request<Role[]>('/roles/')
  },

  async getPublicGroups(): Promise<Array<{
    group_id: number
    name: string
    team_id: number
    team_name: string | null
    description?: string
  }>> {
    return request<Array<{
      group_id: number
      name: string
      team_id: number
      team_name: string | null
      description?: string
    }>>('/auth/groups/')
  },

  async getDemoAccounts(): Promise<DemoAccount[]> {
    return request<DemoAccount[]>('/auth/demo-accounts/')
  }
}

// ----------------------------------------------------
// Tasks & Workflow API
// ----------------------------------------------------
export const tasksApi = {
  async getTasks(params: {
    status?: string
    team_id?: number
    assigned_to?: number
    overdue?: boolean
    search?: string
    page?: number
  } = {}): Promise<PaginatedResponse<Task>> {
    const query = new URLSearchParams()
    if (params.status && params.status !== 'All') query.set('status', params.status)
    if (params.team_id) query.set('team_id', String(params.team_id))
    if (params.assigned_to) query.set('assigned_to', String(params.assigned_to))
    if (params.overdue) query.set('overdue', 'true')
    if (params.search) query.set('search', params.search)
    if (params.page) query.set('page', String(params.page))

    const queryString = query.toString()
    return request<PaginatedResponse<Task>>(`/tasks/${queryString ? `?${queryString}` : ''}`)
  },

  async getTask(taskId: number): Promise<Task> {
    return request<Task>(`/tasks/${taskId}/`)
  },

  async createTask(data: TaskCreatePayload): Promise<Task> {
    const payload = {
      title: data.title,
      description: data.description,
      deadline: data.deadline,
      assigned_to_id: data.assigned_to_id ?? data.assigned_to ?? null,
      team_id: data.team_id ?? data.team ?? null,
      group_id: data.group_id ?? null,
      parent_task_id: data.parent_task_id ?? null,
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.points ? { points: data.points } : {})
    }
    return request<Task>('/tasks/', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  async updateTask(taskId: number, data: Partial<TaskCreatePayload>): Promise<Task> {
    return request<Task>(`/tasks/${taskId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  async deleteTask(taskId: number): Promise<void> {
    return request<void>(`/tasks/${taskId}/`, {
      method: 'DELETE'
    })
  },

  async startTask(taskId: number, note?: string): Promise<Task> {
    return request<Task>(`/tasks/${taskId}/start/`, {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {})
    })
  },

  async getProgressNotes(taskId: number): Promise<TaskProgressNote[]> {
    return request<TaskProgressNote[]>(`/tasks/${taskId}/progress/`)
  },

  async addProgressNote(taskId: number, note: string): Promise<TaskProgressNote> {
    return request<TaskProgressNote>(`/tasks/${taskId}/progress/`, {
      method: 'POST',
      body: JSON.stringify({ note })
    })
  },

  async submitProof(taskId: number, proof: ProofSubmitPayload): Promise<{
    message: string
    proof: TaskProof
    task_status: string
  }> {
    return request<{ message: string; proof: TaskProof; task_status: string }>(
      `/tasks/${taskId}/submit/`,
      {
        method: 'POST',
        body: JSON.stringify(proof)
      }
    )
  },

  async reviewTask(taskId: number, review: ReviewCreatePayload): Promise<{
    message: string
    review: Review
    task_status: string
    points_awarded: number
    scoring_info: string
  }> {
    return request<{
      message: string
      review: Review
      task_status: string
      points_awarded: number
      scoring_info: string
    }>(`/tasks/${taskId}/review/`, {
      method: 'POST',
      body: JSON.stringify(review)
    })
  },

  async getTaskSubmissions(taskId: number): Promise<TaskProof[]> {
    return request<TaskProof[]>(`/tasks/${taskId}/submissions/`)
  },

  async getTaskReviews(taskId: number): Promise<Review[]> {
    return request<Review[]>(`/tasks/${taskId}/reviews/`)
  }
}

export const submissionsApi = {
  submitProof: tasksApi.submitProof,
  reviewTask: tasksApi.reviewTask,
  getSubmissions: tasksApi.getTaskSubmissions,
  getReviews: tasksApi.getTaskReviews,
  async getAllSubmissions(params: { task_id?: number; submitted_by?: number } = {}): Promise<PaginatedResponse<TaskProof> | TaskProof[]> {
    const query = new URLSearchParams()
    if (params.task_id) query.set('task_id', String(params.task_id))
    if (params.submitted_by) query.set('submitted_by', String(params.submitted_by))
    const qs = query.toString() ? `?${query.toString()}` : ''
    return request<PaginatedResponse<TaskProof> | TaskProof[]>(`/submissions/${qs}`)
  },
  async getAllReviews(params: { task_id?: number; reviewer_id?: number } = {}): Promise<PaginatedResponse<Review> | Review[]> {
    const query = new URLSearchParams()
    if (params.task_id) query.set('task_id', String(params.task_id))
    if (params.reviewer_id) query.set('reviewer_id', String(params.reviewer_id))
    const qs = query.toString() ? `?${query.toString()}` : ''
    return request<PaginatedResponse<Review> | Review[]>(`/reviews/${qs}`)
  }
}

// ----------------------------------------------------
// Teams & Groups API
// ----------------------------------------------------
export const teamsApi = {
  async getTeams(params: { type?: string; parent_team_id?: number | 'null' } = {}): Promise<PaginatedResponse<TeamSummary>> {
    const query = new URLSearchParams()
    if (params.type) query.set('type', params.type)
    if (params.parent_team_id !== undefined) query.set('parent_team_id', String(params.parent_team_id))
    const queryString = query.toString()
    return request<PaginatedResponse<TeamSummary>>(`/teams/${queryString ? `?${queryString}` : ''}`)
  },

  async getTeam(teamId: number): Promise<TeamDetail> {
    return request<TeamDetail>(`/teams/${teamId}/`)
  },

  async createTeam(data: { name: string; type: string; description?: string; parent_team?: number | null }): Promise<TeamSummary> {
    return request<TeamSummary>('/teams/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async getTeamMembers(teamId: number): Promise<UserSummary[]> {
    return request<UserSummary[]>(`/teams/${teamId}/members/`)
  },

  async addMember(teamId: number, userId: number): Promise<{ message: string; team_id: number; user_id: number }> {
    return request<{ message: string; team_id: number; user_id: number }>(`/teams/${teamId}/add_member/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId })
    })
  },

  async removeMember(teamId: number, userId: number): Promise<{ message: string; team_id: number; user_id: number }> {
    return request<{ message: string; team_id: number; user_id: number }>(`/teams/${teamId}/remove_member/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId })
    })
  },

  async getGroups(params: { team_id?: number } = {}): Promise<PaginatedResponse<Group>> {
    const query = new URLSearchParams()
    if (params.team_id) query.set('team_id', String(params.team_id))
    const queryString = query.toString()
    return request<PaginatedResponse<Group>>(`/groups/${queryString ? `?${queryString}` : ''}`)
  },

  async createGroup(data: { name: string; team: number; description?: string }): Promise<Group> {
    return request<Group>('/groups/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

// ----------------------------------------------------
// Users API
// ----------------------------------------------------
export const usersApi = {
  async getUsers(params: {
    role_id?: number
    team_id?: number
    status?: string
    search?: string
    page?: number
    page_size?: number
  } = {}): Promise<PaginatedResponse<UserSummary>> {
    const query = new URLSearchParams()
    if (params.role_id) query.set('role_id', String(params.role_id))
    if (params.team_id) query.set('team_id', String(params.team_id))
    if (params.status) query.set('status', params.status)
    if (params.search) query.set('search', params.search)
    if (params.page) query.set('page', String(params.page))
    if (params.page_size) query.set('page_size', String(params.page_size))
    const queryString = query.toString()
    return request<PaginatedResponse<UserSummary>>(`/users/${queryString ? `?${queryString}` : ''}`)
  },

  async getUser(userId: number): Promise<UserDetail> {
    return request<UserDetail>(`/users/${userId}/`)
  },

  async manageUser(userId: number, data: {
    role_id?: number
    team_id?: number | null
    group_id?: number | null
    status?: string
    position?: string | null
    can_post_announcements?: boolean
  }): Promise<{ message: string; user: UserDetail }> {
    return request<{ message: string; user: UserDetail }>(`/users/${userId}/manage/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }
}

// ----------------------------------------------------
// Scoring & Leaderboard API
// ----------------------------------------------------
export const scoringApi = {
  async getLeaderboard(page = 1): Promise<PaginatedResponse<Performance>> {
    const query = new URLSearchParams()
    if (page > 1) query.set('page', String(page))
    const queryString = query.toString()
    return request<PaginatedResponse<Performance>>(`/leaderboard/${queryString ? `?${queryString}` : ''}`)
  }
}

// ----------------------------------------------------
// Announcements API
// ----------------------------------------------------
export const announcementsApi = {
  async getAnnouncements(page = 1): Promise<PaginatedResponse<Announcement>> {
    const query = new URLSearchParams()
    if (page > 1) query.set('page', String(page))
    const queryString = query.toString()
    return request<PaginatedResponse<Announcement>>(`/announcements/${queryString ? `?${queryString}` : ''}`)
  },

  async createAnnouncement(data: FormData | {
    title: string
    content: string
    category?: string
    external_link?: string
    drive_link?: string
    target_role?: string
  }): Promise<Announcement> {
    const isForm = data instanceof FormData
    return request<Announcement>('/announcements/', {
      method: 'POST',
      body: isForm ? data : JSON.stringify(data)
    })
  }
}

// ----------------------------------------------------
// Activity Audit History API
// ----------------------------------------------------
export const activityApi = {
  async getActivityLogs(params: { action?: string; user_id?: number; page?: number } = {}): Promise<PaginatedResponse<HistoryLog>> {
    const query = new URLSearchParams()
    if (params.action) query.set('action', params.action)
    if (params.user_id) query.set('user_id', String(params.user_id))
    if (params.page) query.set('page', String(params.page))
    const queryString = query.toString()
    return request<PaginatedResponse<HistoryLog>>(`/activity/${queryString ? `?${queryString}` : ''}`)
  },

  async exportCsv(params: { action?: string; user_id?: number } = {}): Promise<Blob> {
    const query = new URLSearchParams()
    if (params.action) query.set('action', params.action)
    if (params.user_id) query.set('user_id', String(params.user_id))
    const queryString = query.toString()
    const token = getStoredAccessToken()
    const response = await fetch(`${API_BASE_URL}/activity/export-csv/${queryString ? `?${queryString}` : ''}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    if (!response.ok) {
      throw new Error(`Audit export failed with status ${response.status}`)
    }
    return response.blob()
  }
}

// ----------------------------------------------------
// POST-MVP: Phase 1 — Career Profiles & ATS Resume API
// ----------------------------------------------------
export const careerApi = {
  async getProfile(): Promise<CareerProfile> {
    return request<CareerProfile>('/career/me/')
  },

  async updateProfile(data: Partial<CareerProfile>): Promise<CareerProfile> {
    return request<CareerProfile>('/career/me/', {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  async addEducation(data: Omit<Education, 'id'>): Promise<Education> {
    return request<Education>('/career/educations/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async deleteEducation(id: number): Promise<void> {
    return request<void>(`/career/educations/${id}/`, {
      method: 'DELETE'
    })
  },

  async addProject(data: Omit<PortfolioProject, 'id'>): Promise<PortfolioProject> {
    return request<PortfolioProject>('/career/projects/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async deleteProject(id: number): Promise<void> {
    return request<void>(`/career/projects/${id}/`, {
      method: 'DELETE'
    })
  },

  async addAchievement(data: Omit<Achievement, 'id'>): Promise<Achievement> {
    return request<Achievement>('/career/achievements/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async deleteAchievement(id: number): Promise<void> {
    return request<void>(`/career/achievements/${id}/`, {
      method: 'DELETE'
    })
  },

  async syncContributions(): Promise<{ message: string; contributions: ContributionHighlight[] }> {
    return request<{ message: string; contributions: ContributionHighlight[] }>('/career/contributions/sync/', {
      method: 'POST'
    })
  },

  async toggleContribution(id: number): Promise<ContributionHighlight> {
    return request<ContributionHighlight>(`/career/contributions/${id}/toggle/`, {
      method: 'PATCH'
    })
  },

  async getResumeConfig(): Promise<ResumeConfiguration> {
    return request<ResumeConfiguration>('/career/resume/config/')
  },

  async updateResumeConfig(data: Partial<ResumeConfiguration>): Promise<ResumeConfiguration> {
    return request<ResumeConfiguration>('/career/resume/config/', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  async downloadResumePdf(): Promise<Blob> {
    const token = getStoredAccessToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(`${API_BASE_URL}/career/resume/pdf/`, {
      method: 'GET',
      headers
    })
    if (!response.ok) {
      throw new Error('Failed to download resume PDF')
    }
    return response.blob()
  },

  async getPublicProfile(slug: string): Promise<PublicCareerProfile> {
    return request<PublicCareerProfile>(`/career/public/${slug}/`)
  }
}

// ----------------------------------------------------
// POST-MVP: Phases 2 & 3 — Hackathons, Certificates & Recruitment API
// ----------------------------------------------------
export const hackathonApi = {
  async getHackathons(): Promise<PaginatedResponse<Hackathon> | Hackathon[]> {
    return request<PaginatedResponse<Hackathon> | Hackathon[]>('/hackathons/events/')
  },

  async getHackathon(id: number): Promise<Hackathon> {
    return request<Hackathon>(`/hackathons/events/${id}/`)
  },

  async register(hackathonId: number, data: { phone?: string; college_or_org?: string; full_name?: string; email?: string }): Promise<Participant> {
    return request<Participant>(`/hackathons/events/${hackathonId}/register/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async createTeam(hackathonId: number, data: { team_name: string; project_title?: string; project_repo?: string; project_demo?: string; submission_notes?: string }): Promise<HackathonTeam> {
    return request<HackathonTeam>(`/hackathons/events/${hackathonId}/create_team/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async joinTeam(hackathonId: number, teamId: number, roleInTeam = 'Member'): Promise<HackathonTeam> {
    return request<HackathonTeam>(`/hackathons/events/${hackathonId}/join_team/`, {
      method: 'POST',
      body: JSON.stringify({ team_id: teamId, role_in_team: roleInTeam })
    })
  },

  async submitCertificate(data: { hackathon: number; category: string; certificate_url: string; team?: number | null }): Promise<CertificateSubmission> {
    return request<CertificateSubmission>('/hackathons/certificates/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async getCertificates(): Promise<PaginatedResponse<CertificateSubmission> | CertificateSubmission[]> {
    return request<PaginatedResponse<CertificateSubmission> | CertificateSubmission[]>('/hackathons/certificates/')
  },

  async reviewCertificate(submissionId: number, data: { decision: 'Approved' | 'Rejected'; feedback?: string; override_points?: number }): Promise<CertificateSubmission> {
    return request<CertificateSubmission>(`/hackathons/certificates/${submissionId}/review/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async getLeaderboard(hackathonId: number): Promise<{ hackathon: Hackathon; individual_rankings: HackathonRanking[]; team_rankings: HackathonTeam[] }> {
    return request<{ hackathon: Hackathon; individual_rankings: HackathonRanking[]; team_rankings: HackathonTeam[] }>(`/hackathons/${hackathonId}/leaderboard/`)
  },

  async getShortlist(hackathonId: number, limit = 10): Promise<{ hackathon_id: number; shortlist_count: number; candidates: CandidateShortlist[] }> {
    return request<{ hackathon_id: number; shortlist_count: number; candidates: CandidateShortlist[] }>(`/hackathons/${hackathonId}/shortlist/?limit=${limit}`)
  },

  async updateShortlistDecision(hackathonId: number, data: { candidate_id: number; decision: string; offered_role?: string; decision_reason?: string }): Promise<CandidateShortlist> {
    return request<CandidateShortlist>(`/hackathons/${hackathonId}/shortlist/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  async getRecruitmentAnalytics(hackathonId: number): Promise<RecruitmentAnalytics> {
    return request<RecruitmentAnalytics>(`/hackathons/${hackathonId}/recruitment-analytics/`)
  }
}

// ----------------------------------------------------
// POST-MVP: Phase 4 — Official Documents & Partnerships API
// ----------------------------------------------------
export const documentsApi = {
  // Resources
  async getResources(): Promise<PaginatedResponse<ResourceMaterial> | ResourceMaterial[]> {
    return request<PaginatedResponse<ResourceMaterial> | ResourceMaterial[]>('/documents/resources/')
  },

  async createResource(data: {
    title: string
    description?: string
    category?: 'Guide' | 'Template' | 'Cheatsheet' | 'Brand Asset' | 'Tool'
    file_url: string
    min_role_tier?: number
  }): Promise<ResourceMaterial> {
    return request<ResourceMaterial>('/documents/resources/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async trackResourceDownload(id: number): Promise<{ message: string; download_count: number }> {
    return request<{ message: string; download_count: number }>(`/documents/resources/${id}/track_download/`, {
      method: 'POST'
    })
  },

  // MoUs
  async getMous(): Promise<PaginatedResponse<MouDocument> | MouDocument[]> {
    return request<PaginatedResponse<MouDocument> | MouDocument[]>('/documents/mous/')
  },

  async createMou(data: {
    organization_name: string
    signatory_first_party?: string
    signatory_second_party: string
    scope_of_work: string
    validity_start: string
    validity_end: string
    status?: string
  }): Promise<MouDocument> {
    return request<MouDocument>('/documents/mous/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async reviewMou(id: number, data: { status: string; review_notes?: string }): Promise<MouDocument> {
    return request<MouDocument>(`/documents/mous/${id}/review/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async downloadMouPdf(id: number): Promise<Blob> {
    const token = getStoredAccessToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(`${API_BASE_URL}/documents/mous/${id}/pdf/`, {
      method: 'GET',
      headers
    })
    if (!response.ok) {
      throw new Error('Failed to download MoU PDF')
    }
    return response.blob()
  },

  // Event Proposals
  async getEventProposals(): Promise<PaginatedResponse<EventProposal> | EventProposal[]> {
    return request<PaginatedResponse<EventProposal> | EventProposal[]>('/documents/event-proposals/')
  },

  async createEventProposal(data: {
    title: string
    event_type?: string
    target_date: string
    expected_attendees?: number
    estimated_budget?: number | string
    venue_or_platform: string
    description: string
  }): Promise<EventProposal> {
    return request<EventProposal>('/documents/event-proposals/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async reviewEventProposal(id: number, data: { decision: 'Approved' | 'Rejected' | 'Under Review'; feedback?: string }): Promise<EventProposal> {
    return request<EventProposal>(`/documents/event-proposals/${id}/review/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // Sponsorships
  async getSponsorships(): Promise<PaginatedResponse<SponsorshipProposal> | SponsorshipProposal[]> {
    return request<PaginatedResponse<SponsorshipProposal> | SponsorshipProposal[]>('/documents/sponsorships/')
  },

  async createSponsorship(data: {
    sponsor_organization: string
    sponsorship_tier?: 'Title' | 'Platinum' | 'Gold' | 'Silver' | 'Community'
    amount_requested?: number | string
    contact_person: string
    contact_email: string
    deliverables_offered: string
    notes?: string
    status?: string
  }): Promise<SponsorshipProposal> {
    return request<SponsorshipProposal>('/documents/sponsorships/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // Community Partners
  async getPartners(): Promise<PaginatedResponse<CommunityPartner> | CommunityPartner[]> {
    return request<PaginatedResponse<CommunityPartner> | CommunityPartner[]>('/documents/partners/')
  },

  async createPartner(data: {
    organization_name: string
    partner_type?: 'College Club' | 'Tech Community' | 'Corporate' | 'Media Partner' | 'Incubator'
    website?: string
    poc_name: string
    poc_email: string
    benefits_summary: string
    status?: string
  }): Promise<CommunityPartner> {
    return request<CommunityPartner>('/documents/partners/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

// ----------------------------------------------------
// POST-MVP: Phase 5 — Advanced Analytics & Report Exports API
// ----------------------------------------------------
export const analyticsApi = {
  async getOverview(params?: {
    days?: number | string
    start_date?: string
    end_date?: string
    team_id?: number | string
  }): Promise<AnalyticsOverview> {
    const q = new URLSearchParams()
    if (params?.days) q.append('days', String(params.days))
    if (params?.start_date) q.append('start_date', params.start_date)
    if (params?.end_date) q.append('end_date', params.end_date)
    if (params?.team_id) q.append('team_id', String(params.team_id))
    const qs = q.toString() ? `?${q.toString()}` : ''
    return request<AnalyticsOverview>(`/analytics/overview/${qs}`)
  },

  async downloadTasksCsv(params?: { team_id?: number | string; status?: string }): Promise<Blob> {
    const q = new URLSearchParams()
    if (params?.team_id) q.append('team_id', String(params.team_id))
    if (params?.status) q.append('status', params.status)
    const qs = q.toString() ? `?${q.toString()}` : ''

    const token = getStoredAccessToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(`${API_BASE_URL}/analytics/export/tasks/${qs}`, {
      method: 'GET',
      headers
    })
    if (!response.ok) throw new Error('Failed to export tasks CSV')
    return response.blob()
  },

  async downloadTeamsCsv(): Promise<Blob> {
    const token = getStoredAccessToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(`${API_BASE_URL}/analytics/export/teams/`, {
      method: 'GET',
      headers
    })
    if (!response.ok) throw new Error('Failed to export teams CSV')
    return response.blob()
  },

  async downloadMembersCsv(): Promise<Blob> {
    const token = getStoredAccessToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(`${API_BASE_URL}/analytics/export/members/`, {
      method: 'GET',
      headers
    })
    if (!response.ok) throw new Error('Failed to export members CSV')
    return response.blob()
  },

  async downloadPdfReport(params?: { days?: number | string; team_id?: number | string }): Promise<Blob> {
    const q = new URLSearchParams()
    if (params?.days) q.append('days', String(params.days))
    if (params?.team_id) q.append('team_id', String(params.team_id))
    const qs = q.toString() ? `?${q.toString()}` : ''

    const token = getStoredAccessToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(`${API_BASE_URL}/analytics/export/pdf/${qs}`, {
      method: 'GET',
      headers
    })
    if (!response.ok) throw new Error('Failed to generate PDF operations report')
    return response.blob()
  }
}

// ----------------------------------------------------
// POST-MVP: Phase 6 — Automated Reminders & Escalations API
// ----------------------------------------------------
export const notificationsApi = {
  async getNotifications(unreadOnly = false): Promise<PaginatedResponse<NotificationItem> | NotificationItem[]> {
    const qs = unreadOnly ? '?unread_only=true' : ''
    return request<PaginatedResponse<NotificationItem> | NotificationItem[]>(`/notifications/${qs}`)
  },

  async getSummary(): Promise<NotificationSummary> {
    return request<NotificationSummary>('/notifications/summary/')
  },

  async markAsRead(id: number): Promise<{ message: string; notification_id: number }> {
    return request<{ message: string; notification_id: number }>(`/notifications/${id}/read/`, {
      method: 'POST'
    })
  },

  async markAllRead(): Promise<{ message: string; updated_count: number }> {
    return request<{ message: string; updated_count: number }>('/notifications/mark-all-read/', {
      method: 'POST'
    })
  },

  async triggerReminders(): Promise<{ message: string; summary: any }> {
    return request<{ message: string; summary: any }>('/notifications/trigger-reminders/', {
      method: 'POST'
    })
  }
}

// ----------------------------------------------------
// POST-MVP: Phase 7 — Multi-Level Approval Workflows API
// ----------------------------------------------------
export const approvalsApi = {
  async getWorkflows(params?: {
    status?: string
    stage?: number
    my_queue?: boolean
    submitted_by_me?: boolean
  }): Promise<PaginatedResponse<ApprovalWorkflow> | ApprovalWorkflow[]> {
    const q = new URLSearchParams()
    if (params?.status) q.append('status', params.status)
    if (params?.stage) q.append('stage', String(params.stage))
    if (params?.my_queue) q.append('my_queue', 'true')
    if (params?.submitted_by_me) q.append('submitted_by_me', 'true')
    const qs = q.toString() ? `?${q.toString()}` : ''
    return request<PaginatedResponse<ApprovalWorkflow> | ApprovalWorkflow[]>(`/approvals/${qs}`)
  },

  async getWorkflow(id: number): Promise<ApprovalWorkflow> {
    return request<ApprovalWorkflow>(`/approvals/${id}/`)
  },

  async createWorkflow(data: {
    content_type: string
    object_id: number
    title: string
    description?: string
    total_stages?: number
  }): Promise<ApprovalWorkflow> {
    return request<ApprovalWorkflow>('/approvals/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async submitDecision(
    id: number,
    data: { decision: 'Approved' | 'Changes Requested' | 'Rejected'; feedback?: string }
  ): Promise<ApprovalWorkflow> {
    return request<ApprovalWorkflow>(`/approvals/${id}/decision/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async resubmit(id: number, data: { notes?: string }): Promise<ApprovalWorkflow> {
    return request<ApprovalWorkflow>(`/approvals/${id}/resubmit/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

export const boardApi = {
  async getBoardOverview(): Promise<BoardMonitoringMetrics> {
    return request<BoardMonitoringMetrics>('/board/overview/')
  },

  async getWarnings(params?: { target_user?: number; status?: string }): Promise<PaginatedResponse<BoardWarning> | BoardWarning[]> {
    const q = new URLSearchParams()
    if (params?.target_user) q.append('target_user', String(params.target_user))
    if (params?.status) q.append('status', params.status)
    const qs = q.toString() ? `?${q.toString()}` : ''
    return request<PaginatedResponse<BoardWarning> | BoardWarning[]>(`/board/warnings/${qs}`)
  },

  async issueWarning(data: {
    target_user_id?: number | null
    target_group_id?: number | null
    related_task_id?: number | null
    reason: string
    expiry_date?: string | null
  }): Promise<BoardWarning> {
    return request<BoardWarning>('/board/warnings/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async acknowledgeWarning(id: number): Promise<BoardWarning> {
    return request<BoardWarning>(`/board/warnings/${id}/acknowledge/`, {
      method: 'POST'
    })
  },

  async resolveWarning(id: number): Promise<BoardWarning> {
    return request<BoardWarning>(`/board/warnings/${id}/resolve/`, {
      method: 'POST'
    })
  },

  async reviseDeadline(id: number, revised_deadline: string): Promise<BoardWarning> {
    return request<BoardWarning>(`/board/warnings/${id}/revise_deadline/`, {
      method: 'POST',
      body: JSON.stringify({ revised_deadline })
    })
  },

  async getAuditLogs(): Promise<WarningAuditLog[]> {
    return request<WarningAuditLog[]>('/board/warnings/audit_logs/')
  },

  async getRemovalReviews(params?: { status?: string }): Promise<PaginatedResponse<RemovalReview> | RemovalReview[]> {
    const q = new URLSearchParams()
    if (params?.status) q.append('status', params.status)
    const qs = q.toString() ? `?${q.toString()}` : ''
    return request<PaginatedResponse<RemovalReview> | RemovalReview[]>(`/board/removals/${qs}`)
  },

  async flagForRemoval(data: {
    target_user_id?: number | null
    target_group_id?: number | null
    reason: string
  }): Promise<RemovalReview> {
    return request<RemovalReview>('/board/removals/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async resolveRemoval(
    id: number,
    data: { decision: 'Approved_Deactivated' | 'Rejected'; official_notes?: string }
  ): Promise<RemovalReview> {
    return request<RemovalReview>(`/board/removals/${id}/resolve/`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

// ----------------------------------------------------
// Global Search API
// ----------------------------------------------------
export const searchApi = {
  async search(query: string): Promise<SearchResults> {
    const q = encodeURIComponent(query.trim())
    return request<SearchResults>(`/search/?q=${q}`)
  }
}

// ----------------------------------------------------
// Live ETA API
// ----------------------------------------------------
export const liveEtaApi = {
  async getLiveEta(): Promise<LiveEtaResponse> {
    return request<LiveEtaResponse>('/tasks/live-eta/')
  }
}






