import React, { useState, useEffect } from 'react'
import {
  ListTodo,
  Clock,
  Award,
  AlertTriangle,
  ArrowRight,
  Megaphone,
  RefreshCw,
  Plus,
  ShieldAlert,
  Send,
  UserX,
  FileCheck2,
  TrendingUp,
  Layers,
  Users
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  Alert,
  Modal,
  Input,
  Textarea
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  tasksApi,
  scoringApi,
  announcementsApi,
  boardApi,
  submissionsApi
} from '../services/api'
import type {
  Task,
  Performance,
  Announcement,
  BoardMonitoringMetrics,
  BoardWarning,
  WarningAuditLog,
  RemovalReview
} from '../types/api'
import './DashboardView.css'

interface DashboardViewProps {
  onNavigateToTasks: () => void
  onNavigateToTeams?: () => void
  onNavigateToAnnouncements?: () => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToTasks,
  onNavigateToTeams,
  onNavigateToAnnouncements
}) => {
  const { user, roleTier, roleName } = useAuth()

  // Real backend data states
  const [tasks, setTasks] = useState<Task[]>([])
  const [leaderboard, setLeaderboard] = useState<Performance[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [boardMetrics, setBoardMetrics] = useState<BoardMonitoringMetrics | null>(null)
  const [warnings, setWarnings] = useState<BoardWarning[]>([])
  const [removals, setRemovals] = useState<RemovalReview[]>([])
  const [auditLogs, setAuditLogs] = useState<WarningAuditLog[]>([])

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  // Interactive Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [submitForm, setSubmitForm] = useState({ github_link: '', screenshots: '', description: '' })

  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewTask, setReviewTask] = useState<Task | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'Approved' | 'Changes Requested'>('Approved')
  const [reviewFeedback, setReviewFeedback] = useState('')

  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningForm, setWarningForm] = useState({ target_user_id: '', reason: '', expiry_date: '' })

  const [showReviseModal, setShowReviseModal] = useState(false)
  const [selectedWarningToRevise, setSelectedWarningToRevise] = useState<BoardWarning | null>(null)
  const [revisedDeadlineDate, setRevisedDeadlineDate] = useState('')

  const [showRemovalModal, setShowRemovalModal] = useState(false)
  const [removalForm, setRemovalForm] = useState({ target_user_id: '', reason: '' })

  const [showResolveRemovalModal, setShowResolveRemovalModal] = useState(false)
  const [selectedRemoval, setSelectedRemoval] = useState<RemovalReview | null>(null)
  const [resolveForm, setResolveForm] = useState({ decision: 'Approved_Deactivated' as 'Approved_Deactivated' | 'Rejected', notes: '' })

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Determine user level (1 = Founder/Official, 2 = Director of Core Operations, 3 = Core Lead, 4 = Member)
  const hierarchyLevel = user?.hierarchy_level ?? (roleTier <= 2 ? 1 : roleTier === 3 ? 3 : 4)
  const isFounder = user?.role?.name === 'Founder' || roleName === 'Founder' || user?.role_name === 'Founder'
  const isOfficialUser = hierarchyLevel === 1 || ['Founder', 'Chairman', 'Managing Director', 'President', 'Official'].includes(roleName)
  const isOfficialOnly = isOfficialUser && !isFounder
  const isBoardUser = hierarchyLevel === 2 || roleName === 'Director of Core Operations'
  const isCoreTeamUser = hierarchyLevel === 3 || ['Core Team Lead', 'Core Lead'].includes(roleName)
  const isMemberUser = !isOfficialUser && !isBoardUser && !isCoreTeamUser

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const promises: Promise<any>[] = [
        tasksApi.getTasks({ page: 1 }),
        announcementsApi.getAnnouncements(1)
      ]

      if (isMemberUser || isCoreTeamUser) {
        promises.push(scoringApi.getLeaderboard(1))
      }

      if (isBoardUser || isOfficialUser) {
        promises.push(boardApi.getBoardOverview())
        promises.push(boardApi.getWarnings())
        promises.push(boardApi.getRemovalReviews())
        promises.push(boardApi.getAuditLogs())
      }

      const results = await Promise.allSettled(promises)

      if (results[0].status === 'fulfilled') {
        const val = results[0].value
        setTasks(Array.isArray(val) ? val : val.results || [])
      }

      if (results[1].status === 'fulfilled') {
        const val = results[1].value
        setAnnouncements(Array.isArray(val) ? val : val.results || [])
      }

      if (isMemberUser || isCoreTeamUser) {
        if (results[2] && results[2].status === 'fulfilled') {
          const val = results[2].value
          setLeaderboard(Array.isArray(val) ? val : val.results || [])
        }
      }

      if (isBoardUser || isOfficialUser) {
        if (results[2] && results[2].status === 'fulfilled') {
          setBoardMetrics(results[2].value)
        }
        if (results[3] && results[3].status === 'fulfilled') {
          const val = results[3].value
          setWarnings(Array.isArray(val) ? val : val.results || [])
        }
        if (results[4] && results[4].status === 'fulfilled') {
          const val = results[4].value
          setRemovals(Array.isArray(val) ? val : val.results || [])
        }
        if (results[5] && results[5].status === 'fulfilled') {
          const val = results[5].value
          setAuditLogs(Array.isArray(val) ? val : val.results || [])
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  // Metric Computations
  const totalTasks = tasks.length
  const assignedCount = tasks.filter((t) => t.status === 'Assigned').length
  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length
  const submittedCount = tasks.filter((t) => t.status === 'Submitted').length
  const approvedCount = tasks.filter((t) => t.status === 'Approved').length
  const overdueCount = tasks.filter((t) => t.is_overdue).length

  // Find user's performance record
  const myPerformance = leaderboard.find((p) => p.user?.user_id === user?.user_id)
  const myPoints = myPerformance ? myPerformance.points : 0
  const myRank = myPerformance ? myPerformance.rank : '-'

  // Handlers for Member Submission
  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTask) return
    setIsSubmitting(true)
    try {
      await submissionsApi.submitProof(selectedTask.task_id, submitForm)
      setStatusMessage({ type: 'success', text: `Work submitted for "${selectedTask.title}". Task is now Submitted for review.` })
      setShowSubmitModal(false)
      setSubmitForm({ github_link: '', screenshots: '', description: '' })
      fetchDashboardData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to submit proof.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handlers for Core Lead Review
  const handleReviewTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewTask) return
    setIsSubmitting(true)
    try {
      await submissionsApi.reviewTask(reviewTask.task_id, {
        decision: reviewDecision,
        feedback: reviewFeedback
      })
      setStatusMessage({
        type: 'success',
        text: `Review submitted: Task #${reviewTask.task_id} marked as ${reviewDecision}.`
      })
      setShowReviewModal(false)
      setReviewFeedback('')
      fetchDashboardData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to complete review.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handlers for Board Warning
  const handleIssueWarning = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await boardApi.issueWarning({
        target_user_id: warningForm.target_user_id ? Number(warningForm.target_user_id) : undefined,
        reason: warningForm.reason,
        expiry_date: warningForm.expiry_date || null
      })
      setStatusMessage({ type: 'success', text: 'Warning issued successfully (recorded in Board Compliance Audit).' })
      setShowWarningModal(false)
      setWarningForm({ target_user_id: '', reason: '', expiry_date: '' })
      fetchDashboardData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to issue warning.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handler for Assigning Revised Deadline (Director of Core Operations)
  const handleAssignRevisedDeadline = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWarningToRevise || !revisedDeadlineDate) return
    setIsSubmitting(true)
    try {
      await boardApi.reviseDeadline(selectedWarningToRevise.warning_id, revisedDeadlineDate)
      setStatusMessage({
        type: 'success',
        text: `Revised deadline assigned successfully for Warning #${selectedWarningToRevise.warning_id}. Audit record updated.`
      })
      setShowReviseModal(false)
      setSelectedWarningToRevise(null)
      setRevisedDeadlineDate('')
      fetchDashboardData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err?.message || 'Failed to assign revised deadline.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handlers for Flagging Removal
  const handleFlagRemoval = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await boardApi.flagForRemoval({
        target_user_id: removalForm.target_user_id ? Number(removalForm.target_user_id) : undefined,
        reason: removalForm.reason
      })
      setStatusMessage({ type: 'success', text: 'User flagged for removal review by Official Team.' })
      setShowRemovalModal(false)
      setRemovalForm({ target_user_id: '', reason: '' })
      fetchDashboardData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to flag user.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handlers for Official Resolving Removal
  const handleResolveRemoval = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRemoval) return
    setIsSubmitting(true)
    try {
      await boardApi.resolveRemoval(selectedRemoval.review_id, {
        decision: resolveForm.decision,
        official_notes: resolveForm.notes
      })
      setStatusMessage({
        type: 'success',
        text: `Removal review #${selectedRemoval.review_id} resolved with decision: ${resolveForm.decision}.`
      })
      setShowResolveRemovalModal(false)
      fetchDashboardData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to resolve removal review.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getDeadlineBadge = (task: Task) => {
    const text = task.deadline_display || (task.is_overdue ? 'Overdue' : 'Scheduled')
    if (text === 'Overdue') {
      return <Badge variant="danger" size="sm">{text}</Badge>
    }
    if (text === 'Due today') {
      return <Badge variant="warning" size="sm">{text}</Badge>
    }
    if (text === 'Due tomorrow') {
      return <Badge variant="info" size="sm">{text}</Badge>
    }
    return <Badge variant="default" size="sm">{text}</Badge>
  }

  const getStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case 'Approved':
        return <Badge variant="success" size="sm">Approved</Badge>
      case 'Submitted':
        return <Badge variant="info" size="sm">Submitted</Badge>
      case 'In Progress':
        return <Badge variant="primary" size="sm">In Progress</Badge>
      case 'Changes Requested':
        return <Badge variant="warning" size="sm">Changes Requested</Badge>
      default:
        return <Badge variant="default" size="sm">Assigned</Badge>
    }
  }

  return (
    <div className="dashboard-page">
      {/* Restrained Professional Welcome Banner */}
      <div className="dashboard-header-block">
        <div className="dashboard-title-group">
          <div className="dashboard-hierarchy-pill">
            <span className="hierarchy-badge">
              {isFounder
                ? 'Founder'
                : isOfficialUser
                ? 'Officials'
                : isBoardUser
                ? 'Director of Core Operations'
                : isCoreTeamUser
                ? 'Core Leads'
                : 'Members — TechNeekX Family 🎀'}
            </span>
            {user?.position && <span className="position-pill">{user.position}</span>}
            {user?.group_name && <span className="group-pill">Group: {user.group_name}</span>}
          </div>
          <h1 className="dashboard-heading">
            {isFounder
              ? 'Founder Executive Dashboard'
              : isOfficialUser
              ? 'Officials Governance Dashboard'
              : isBoardUser
              ? 'Director of Core Operations Dashboard'
              : isCoreTeamUser
              ? 'Core Leads Operations Dashboard'
              : 'Member Workspace & Deliverables'}
          </h1>
          <p className="dashboard-subheading">
            Signed in as <strong>{user?.name}</strong> • Role: <strong>{user?.position ? `${roleName} (${user.position})` : roleName}</strong>
            {user?.group_name && <> • Group: <strong>{user.group_name}</strong></>}
          </p>
        </div>

        <div className="dashboard-actions-group">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToTasks}
            rightIcon={<ArrowRight size={14} />}
          >
            View All Tasks
          </Button>
        </div>
      </div>

      {statusMessage && (
        <Alert
          variant={statusMessage.type}
          title={statusMessage.type === 'success' ? 'Operation Completed' : 'Notice'}
          description={statusMessage.text}
          onClose={() => setStatusMessage(null)}
        />
      )}

      {error && (
        <Alert
          variant="danger"
          title="Data Synchronization Notice"
          description={error}
        />
      )}

      {/* ==================================================================== */}
      {/* 1. MEMBER DASHBOARD (Level 4) */}
      {/* ==================================================================== */}
      {isMemberUser && (
        <>
          <div className="metrics-grid">
            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">My Assigned Tasks</span>
                  <div className="metric-icon-bubble metric-icon-primary"><ListTodo size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{totalTasks}</span>
                  <span className="metric-caption">{assignedCount + inProgressCount} active</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Submitted for Review</span>
                  <div className="metric-icon-bubble metric-icon-info"><FileCheck2 size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{submittedCount}</span>
                  <span className="metric-caption">Awaiting lead feedback</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Overdue Tasks</span>
                  <div className="metric-icon-bubble metric-icon-warning"><Clock size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{overdueCount}</span>
                  <span className="metric-caption">{overdueCount > 0 ? 'Urgent attention required' : 'All deadlines on track'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Community Points & Rank</span>
                  <div className="metric-icon-bubble metric-icon-success"><Award size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{myPoints} pts</span>
                  <span className="metric-caption">Rank #{myRank}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-grid-layout">
            <Card>
              <CardHeader className="card-header-action">
                <div>
                  <CardTitle>My Deliverables & Tasks</CardTitle>
                  <CardDescription>Personal task assignments and deadlines</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton height="160px" />
                ) : tasks.length === 0 ? (
                  <EmptyState
                    title="No Assigned Tasks"
                    description="You are currently up to date on all group assignments."
                  />
                ) : (
                  <div className="table-responsive">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Group</th>
                          <th>Deadline</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.slice(0, 6).map((task) => (
                          <tr key={task.task_id}>
                            <td className="task-title-cell">
                              <strong>{task.title}</strong>
                              {task.parent_task_title && (
                                <span className="subtask-parent-hint">↳ Subtask of: {task.parent_task_title}</span>
                              )}
                            </td>
                            <td>{task.group_name || task.team_name || 'General'}</td>
                            <td>{getDeadlineBadge(task)}</td>
                            <td>{getStatusBadge(task.status)}</td>
                            <td>
                              {task.status !== 'Approved' && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setSelectedTask(task)
                                    setShowSubmitModal(true)
                                  }}
                                >
                                  {task.status === 'Submitted' ? 'Resubmit Proof' : 'Submit Proof'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Official Announcements for Members */}
            <Card>
              <CardHeader>
                <CardTitle>Official Announcements</CardTitle>
                <CardDescription>Directives broadcast from the Official Team</CardDescription>
              </CardHeader>
              <CardContent>
                {announcements.length === 0 ? (
                  <EmptyState title="No Announcements" description="No active broadcasts at this time." />
                ) : (
                  <div className="announcements-list">
                    {announcements.slice(0, 4).map((ann) => (
                      <div key={ann.announcement_id} className="announcement-item">
                        <div className="announcement-top">
                          <Megaphone size={14} className="announcement-icon" />
                          <h4 className="announcement-title">{ann.title}</h4>
                        </div>
                        <p className="announcement-text">{ann.content}</p>
                        <span className="announcement-meta">Posted by {ann.created_by?.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* 2. CORE TEAM DASHBOARD (Level 3 — Leads & Deputies) */}
      {/* ==================================================================== */}
      {isCoreTeamUser && (
        <>
          <div className="metrics-grid">
            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Group Tasks Assigned</span>
                  <div className="metric-icon-bubble metric-icon-primary"><ListTodo size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{totalTasks}</span>
                  <span className="metric-caption">Within your authorized group</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Submissions Awaiting Review</span>
                  <div className="metric-icon-bubble metric-icon-info"><FileCheck2 size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{submittedCount}</span>
                  <span className="metric-caption">Require lead evaluation</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Overdue Tasks in Group</span>
                  <div className="metric-icon-bubble metric-icon-warning"><Clock size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{overdueCount}</span>
                  <span className="metric-caption">Needs follow-up</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Group Approval Rate</span>
                  <div className="metric-icon-bubble metric-icon-success"><TrendingUp size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">
                    {totalTasks > 0 ? Math.round((approvedCount / totalTasks) * 100) : 0}%
                  </span>
                  <span className="metric-caption">{approvedCount} approved deliverables</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-grid-layout">
            <Card>
              <CardHeader className="card-header-action">
                <div>
                  <CardTitle>Member Submissions Awaiting Your Review</CardTitle>
                  <CardDescription>Evaluate code, verify proofs, and award points</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {tasks.filter((t) => t.status === 'Submitted').length === 0 ? (
                  <EmptyState
                    title="Queue Empty"
                    description="No pending submissions awaiting review in your group."
                  />
                ) : (
                  <div className="table-responsive">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Assignee</th>
                          <th>Deadline</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.filter((t) => t.status === 'Submitted').map((task) => (
                          <tr key={task.task_id}>
                            <td><strong>{task.title}</strong></td>
                            <td>{task.assigned_to?.name || 'Group member'}</td>
                            <td>{getDeadlineBadge(task)}</td>
                            <td>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  setReviewTask(task)
                                  setShowReviewModal(true)
                                }}
                              >
                                Review Submission
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Group Task Delegation</CardTitle>
                <CardDescription>Downward task assignment to members</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="card-hint-text">
                  As Core Lead, you can delegate subtasks to members of your authorized group:
                  <strong> {user?.group_name || 'Assigned Group'}</strong>.
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  leftIcon={<Plus size={16} />}
                  onClick={onNavigateToTasks}
                >
                  Delegate Task to Member
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* 3. BOARD DASHBOARD (Level 2 — Director of Core Operations) */}
      {/* ==================================================================== */}
      {isBoardUser && (
        <>
          <div className="metrics-grid">
            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Missing Reports (&gt;48h)</span>
                  <div className="metric-icon-bubble metric-icon-warning"><AlertTriangle size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{boardMetrics?.total_missing_reports ?? 0}</span>
                  <span className="metric-caption">Delinquent deliverables</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Monitored Overdue Tasks</span>
                  <div className="metric-icon-bubble metric-icon-warning"><Clock size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{boardMetrics?.total_overdue ?? 0}</span>
                  <span className="metric-caption">Require corrective action</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Active Board Warnings</span>
                  <div className="metric-icon-bubble metric-icon-primary"><ShieldAlert size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{boardMetrics?.total_active_warnings ?? warnings.length}</span>
                  <span className="metric-caption">Max 5 active warnings per user</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Flagged for Removal</span>
                  <div className="metric-icon-bubble metric-icon-danger"><UserX size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{boardMetrics?.total_pending_removals ?? removals.length}</span>
                  <span className="metric-caption">Awaiting Official determination</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-grid-layout">
            <Card>
              <CardHeader className="card-header-action">
                <div>
                  <CardTitle>Daily Reporting & Compliance Monitor</CardTitle>
                  <CardDescription>Delayed, missing, and overdue deliverables across groups</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<ShieldAlert size={14} />}
                  onClick={() => setShowWarningModal(true)}
                >
                  Issue Board Warning
                </Button>
              </CardHeader>
              <CardContent>
                <div className="table-responsive">
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Delinquent Task</th>
                        <th>Assignee</th>
                        <th>Group</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(boardMetrics?.recent_overdue_tasks || []).map((t) => (
                        <tr key={t.task_id}>
                          <td><strong>{t.title}</strong></td>
                          <td>{t.assigned_to}</td>
                          <td>{t.group}</td>
                          <td><Badge variant="danger" size="sm">Overdue</Badge></td>
                          <td>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setWarningForm({
                                  target_user_id: '',
                                  reason: `Task #${t.task_id} (${t.title}) is overdue without required reporting submission.`,
                                  expiry_date: ''
                                })
                                setShowWarningModal(true)
                              }}
                            >
                              Issue Warning
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="card-header-action">
                <div>
                  <CardTitle>Active Overdue & Compliance Warnings</CardTitle>
                  <CardDescription>Real-time tracked incomplete & delinquent deliverables (5-active limit)</CardDescription>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<UserX size={14} />}
                    onClick={() => setShowRemovalModal(true)}
                  >
                    Flag for Removal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {warnings.filter((w) => w.status === 'Active').length === 0 ? (
                  <EmptyState title="No Active Warnings" description="All members and groups are currently in compliance." />
                ) : (
                  <div className="table-responsive">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Target</th>
                          <th>Category & Reason</th>
                          <th>Deadline / Expiry</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warnings
                          .filter((w) => w.status === 'Active')
                          .slice(0, 10)
                          .map((w) => (
                            <tr key={w.warning_id}>
                              <td>
                                <strong>{w.target_user_name || w.target_group_name}</strong>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 13 }}>{w.reason}</span>
                                  {w.category && (
                                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                      {w.category}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {w.revised_deadline ? (
                                  <Badge variant="primary" size="sm">
                                    Revised: {new Date(w.revised_deadline).toLocaleDateString()}
                                  </Badge>
                                ) : w.expiry_date ? (
                                  <span>{new Date(w.expiry_date).toLocaleDateString()}</span>
                                ) : (
                                  <span className="text-muted">Overdue</span>
                                )}
                              </td>
                              <td>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedWarningToRevise(w)
                                    setRevisedDeadlineDate(
                                      w.revised_deadline
                                        ? w.revised_deadline.split('T')[0]
                                        : new Date().toISOString().split('T')[0]
                                    )
                                    setShowReviseModal(true)
                                  }}
                                >
                                  Assign Revised Deadline
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Warning History / Audit Log */}
          <Card style={{ marginTop: 20 }}>
            <CardHeader>
              <div>
                <CardTitle>Warning History & Audit Log</CardTitle>
                <CardDescription>
                  Append-only compliance audit trail: warnings issued, deadlines revised, and completed task resolutions.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <EmptyState
                  title="No Audit Logs Recorded"
                  description="Audit entries will populate as warnings are issued, deadlines revised, or tasks completed."
                />
              ) : (
                <div className="table-responsive">
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Warning Reference</th>
                        <th>Audit Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 15).map((log) => (
                        <tr key={log.audit_id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td>
                            <Badge
                              variant={
                                log.action.toLowerCase().includes('resolved')
                                  ? 'success'
                                  : log.action.toLowerCase().includes('revised')
                                  ? 'primary'
                                  : log.action.toLowerCase().includes('removal')
                                  ? 'danger'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {log.action}
                            </Badge>
                          </td>
                          <td>
                            <strong>{log.actor_name || 'System Auto-Monitor'}</strong>
                          </td>
                          <td>Warning #{log.warning_id}</td>
                          <td style={{ fontSize: 13 }}>{log.details || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ==================================================================== */}
      {/* 4A. FOUNDER EXECUTIVE DASHBOARD (Level 1 — Founder) */}
      {/* ==================================================================== */}
      {isFounder && (
        <>
          <div className="metrics-grid">
            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Organization Deliverables</span>
                  <div className="metric-icon-bubble metric-icon-primary"><Layers size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{totalTasks}</span>
                  <span className="metric-caption">{approvedCount} completed ({totalTasks > 0 ? Math.round((approvedCount / totalTasks) * 100) : 0}%)</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Awaiting Lead / Exec Review</span>
                  <div className="metric-icon-bubble metric-icon-info"><FileCheck2 size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{submittedCount}</span>
                  <span className="metric-caption">In review pipeline</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Overdue & Missing Reports</span>
                  <div className="metric-icon-bubble metric-icon-warning"><Clock size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">
                    {(boardMetrics?.total_overdue ?? overdueCount) + (boardMetrics?.total_missing_reports ?? 0)}
                  </span>
                  <span className="metric-caption">Require executive attention</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Pending Removal Reviews</span>
                  <div className="metric-icon-bubble metric-icon-danger"><UserX size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{removals.filter((r) => r.status === 'Pending').length}</span>
                  <span className="metric-caption">Awaiting Founder determination</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-grid-layout">
            <Card>
              <CardHeader className="card-header-action">
                <div>
                  <CardTitle>Group Performance & Accountability</CardTitle>
                  <CardDescription>Live reporting rates and deliverable tracking across authorized groups</CardDescription>
                </div>
                {onNavigateToTeams && (
                  <Button size="sm" variant="outline" onClick={onNavigateToTeams} leftIcon={<Users size={14} />}>
                    Manage Groups
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {(!boardMetrics?.group_statistics || boardMetrics.group_statistics.length === 0) ? (
                  <EmptyState title="No Group Statistics" description="Group metrics will populate as groups submit deliverable reports." />
                ) : (
                  <div className="table-responsive">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Group</th>
                          <th>Members</th>
                          <th>Tasks</th>
                          <th>Overdue</th>
                          <th>Completion Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boardMetrics.group_statistics.map((group) => (
                          <tr key={group.group_id}>
                            <td><strong>{group.name}</strong></td>
                            <td>{group.members_count}</td>
                            <td>{group.total_tasks}</td>
                            <td>
                              {group.overdue_tasks > 0 ? (
                                <Badge variant="warning" size="sm">{group.overdue_tasks}</Badge>
                              ) : (
                                <Badge variant="success" size="sm">0</Badge>
                              )}
                            </td>
                            <td>
                              <div className="completion-bar-wrapper">
                                <div className="completion-bar-track">
                                  <div
                                    className="completion-bar-fill"
                                    style={{ width: `${Math.min(100, Math.max(0, group.completion_rate))}%` }}
                                  />
                                </div>
                                <span className="completion-rate-text">{Math.round(group.completion_rate)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="dashboard-column-stack">
              <Card>
                <CardHeader>
                  <CardTitle>Executive Governance Actions</CardTitle>
                  <CardDescription>Direct organizational hierarchy management</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="card-hint-text">
                    Create executive directives, delegate downward to Officials or Core Leads, and broadcast official announcements to the community.
                  </p>
                  <div className="action-buttons-stack">
                    <Button
                      variant="primary"
                      className="w-full"
                      leftIcon={<Plus size={16} />}
                      onClick={onNavigateToTasks}
                    >
                      Delegate Executive Task
                    </Button>
                    {onNavigateToTeams && (
                      <Button
                        variant="outline"
                        className="w-full"
                        leftIcon={<Users size={16} />}
                        onClick={onNavigateToTeams}
                      >
                        Manage Teams & Groups
                      </Button>
                    )}
                    {onNavigateToAnnouncements && (
                      <Button
                        variant="outline"
                        className="w-full"
                        leftIcon={<Megaphone size={16} />}
                        onClick={onNavigateToAnnouncements}
                      >
                        Publish Official Announcement
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="card-header-action">
                  <div>
                    <CardTitle>Pending Removals</CardTitle>
                    <CardDescription>Awaiting determination</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {removals.filter((r) => r.status === 'Pending').length === 0 ? (
                    <EmptyState title="No Pending Removals" description="No members or groups currently flagged for removal." />
                  ) : (
                    <div className="warnings-list">
                      {removals.filter((r) => r.status === 'Pending').slice(0, 3).map((r) => (
                        <div key={r.review_id} className="warning-item">
                          <div className="warning-header">
                            <span className="warning-target"><strong>{r.target_user_name || r.target_group_name}</strong></span>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setSelectedRemoval(r)
                                setShowResolveRemovalModal(true)
                              }}
                            >
                              Decide
                            </Button>
                          </div>
                          <p className="warning-reason">{r.reason}</p>
                          <span className="warning-footer">Flagged by {r.flagged_by_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* 4B. OFFICIAL TEAM DASHBOARD (Level 1 — Chairman, MD, Pres, Official) */}
      {/* ==================================================================== */}
      {isOfficialOnly && (
        <>
          <div className="metrics-grid">
            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Organization Directives</span>
                  <div className="metric-icon-bubble metric-icon-primary"><Layers size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{totalTasks}</span>
                  <span className="metric-caption">{approvedCount} completed ({totalTasks > 0 ? Math.round((approvedCount / totalTasks) * 100) : 0}%)</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Submissions in Pipeline</span>
                  <div className="metric-icon-bubble metric-icon-info"><FileCheck2 size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{submittedCount}</span>
                  <span className="metric-caption">Require review</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Overdue Tasks</span>
                  <div className="metric-icon-bubble metric-icon-warning"><Clock size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{overdueCount}</span>
                  <span className="metric-caption">Require follow-up</span>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="metric-content">
                <div className="metric-header">
                  <span className="metric-label">Pending Removal Reviews</span>
                  <div className="metric-icon-bubble metric-icon-danger"><UserX size={18} /></div>
                </div>
                <div className="metric-value-row">
                  <span className="metric-number">{removals.filter((r) => r.status === 'Pending').length}</span>
                  <span className="metric-caption">Require Official sign-off</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-grid-layout">
            <Card>
              <CardHeader>
                <CardTitle>Removal Reviews Awaiting Determination</CardTitle>
                <CardDescription>
                  Board recommendations for member/group removal. Only the Official Team can finalize deactivations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {removals.filter((r) => r.status === 'Pending').length === 0 ? (
                  <EmptyState title="No Pending Removal Reviews" description="No members or groups currently flagged for removal." />
                ) : (
                  <div className="table-responsive">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Target</th>
                          <th>Reason</th>
                          <th>Flagged By</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {removals.filter((r) => r.status === 'Pending').map((r) => (
                          <tr key={r.review_id}>
                            <td><strong>{r.target_user_name || r.target_group_name}</strong></td>
                            <td className="table-reason-cell">{r.reason}</td>
                            <td>{r.flagged_by_name}</td>
                            <td>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  setSelectedRemoval(r)
                                  setShowResolveRemovalModal(true)
                                }}
                              >
                                Review & Decide
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Downward Task Delegation</CardTitle>
                <CardDescription>Founder → Official → Core Lead → Member</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="card-hint-text">
                  Create executive tasks and assign them directly to Officials, Board Directors, or Core Leads to trigger the delegation hierarchy.
                </p>
                <div className="action-buttons-stack">
                  <Button
                    variant="primary"
                    className="w-full"
                    leftIcon={<Plus size={16} />}
                    onClick={onNavigateToTasks}
                  >
                    Create Official Task
                  </Button>
                  {onNavigateToAnnouncements && (
                    <Button
                      variant="outline"
                      className="w-full"
                      leftIcon={<Megaphone size={16} />}
                      onClick={onNavigateToAnnouncements}
                    >
                      Publish Announcement
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* MODALS */}
      {/* ==================================================================== */}

      {/* 1. Member Submit Proof Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={`Submit Deliverable Proof: ${selectedTask?.title}`}
      >
        <form onSubmit={handleSubmitProof} className="modal-form">
          <Input
            label="GitHub Repository or Pull Request Link"
            placeholder="https://github.com/organization/repo/pull/123"
            value={submitForm.github_link}
            onChange={(e) => setSubmitForm({ ...submitForm, github_link: e.target.value })}
            required
          />

          <Input
            label="Proof Screenshot / Evidence URL"
            placeholder="https://example.com/screenshot.png"
            value={submitForm.screenshots}
            onChange={(e) => setSubmitForm({ ...submitForm, screenshots: e.target.value })}
          />

          <Textarea
            label="Implementation Notes & Deliverables Description"
            placeholder="Summarize the changes completed, testing performed, and architectural decisions..."
            value={submitForm.description}
            onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })}
            rows={4}
          />

          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} leftIcon={<Send size={16} />}>
              Submit for Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. Core Lead Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={`Review Deliverable: ${reviewTask?.title}`}
      >
        <form onSubmit={handleReviewTask} className="modal-form">
          <div className="form-group">
            <label className="form-label">Review Decision</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="decision"
                  value="Approved"
                  checked={reviewDecision === 'Approved'}
                  onChange={() => setReviewDecision('Approved')}
                />
                <span className="radio-text">Approve Deliverable (Awards Community Points)</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="decision"
                  value="Changes Requested"
                  checked={reviewDecision === 'Changes Requested'}
                  onChange={() => setReviewDecision('Changes Requested')}
                />
                <span className="radio-text">Request Changes (Requires Member Correction)</span>
              </label>
            </div>
          </div>

          <Textarea
            label="Review Feedback & Correction Guidelines"
            placeholder="Provide specific feedback, code review comments, or next steps..."
            value={reviewFeedback}
            onChange={(e) => setReviewFeedback(e.target.value)}
            rows={4}
            required
          />

          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Submit Evaluation
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Board Issue Warning Modal */}
      <Modal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Issue Board Compliance Warning"
      >
        <form onSubmit={handleIssueWarning} className="modal-form">
          <Input
            label="Target User ID (Numeric ID)"
            placeholder="e.g. 15"
            value={warningForm.target_user_id}
            onChange={(e) => setWarningForm({ ...warningForm, target_user_id: e.target.value })}
            required
          />

          <Textarea
            label="Warning Reason & Compliance Deficit"
            placeholder="Specify the missed reporting deadline, incomplete submission, or governance violation..."
            value={warningForm.reason}
            onChange={(e) => setWarningForm({ ...warningForm, reason: e.target.value })}
            rows={4}
            required
          />

          <Input
            type="date"
            label="Configured Expiry Date (Optional)"
            value={warningForm.expiry_date}
            onChange={(e) => setWarningForm({ ...warningForm, expiry_date: e.target.value })}
          />

          <p className="modal-rule-note">
            Enforced Rule: Max 5 active warnings per user. If a 5th warning is reached, the user is automatically flagged for Official removal review.
          </p>

          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowWarningModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" isLoading={isSubmitting}>
              Issue Warning
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Flag for Removal Modal */}
      <Modal
        isOpen={showRemovalModal}
        onClose={() => setShowRemovalModal(false)}
        title="Flag Member/Group for Removal Review"
      >
        <form onSubmit={handleFlagRemoval} className="modal-form">
          <Input
            label="Target User ID"
            placeholder="e.g. 15"
            value={removalForm.target_user_id}
            onChange={(e) => setRemovalForm({ ...removalForm, target_user_id: e.target.value })}
            required
          />

          <Textarea
            label="Justification for Removal Review"
            placeholder="Document repeated missed reports, non-compliance, or accumulated active warnings..."
            value={removalForm.reason}
            onChange={(e) => setRemovalForm({ ...removalForm, reason: e.target.value })}
            rows={4}
            required
          />

          <p className="modal-rule-note">
            Safety Guard: Board members flag reviews. Final deactivation requires Official Team authorization.
          </p>

          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowRemovalModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" isLoading={isSubmitting}>
              Submit for Official Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Official Resolve Removal Modal */}
      <Modal
        isOpen={showResolveRemovalModal}
        onClose={() => setShowResolveRemovalModal(false)}
        title={`Final Determination: Removal Review #${selectedRemoval?.review_id}`}
      >
        <form onSubmit={handleResolveRemoval} className="modal-form">
          <p className="modal-rule-note">
            Target: <strong>{selectedRemoval?.target_user_name}</strong> • Reason: {selectedRemoval?.reason}
          </p>

          <div className="form-group">
            <label className="form-label">Official Determination</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="determination"
                  value="Approved_Deactivated"
                  checked={resolveForm.decision === 'Approved_Deactivated'}
                  onChange={() => setResolveForm({ ...resolveForm, decision: 'Approved_Deactivated' })}
                />
                <span className="radio-text">
                  <strong>Approve & Deactivate</strong> (Safely deactivates user account; preserves all audit history)
                </span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="determination"
                  value="Rejected"
                  checked={resolveForm.decision === 'Rejected'}
                  onChange={() => setResolveForm({ ...resolveForm, decision: 'Rejected' })}
                />
                <span className="radio-text">
                  <strong>Reject Removal</strong> (Retains active status; dismisses removal flag)
                </span>
              </label>
            </div>
          </div>

          <Textarea
            label="Official Notes & Recorded Justification"
            placeholder="Official executive notes for audit logs..."
            value={resolveForm.notes}
            onChange={(e) => setResolveForm({ ...resolveForm, notes: e.target.value })}
            rows={3}
          />

          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowResolveRemovalModal(false)}>
              Cancel
            </Button>
            <Button variant={resolveForm.decision === 'Approved_Deactivated' ? 'danger' : 'primary'} type="submit" isLoading={isSubmitting}>
              Confirm Decision
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. Assign Revised Deadline Modal (Director of Core Operations) */}
      <Modal
        isOpen={showReviseModal}
        onClose={() => setShowReviseModal(false)}
        title={`Assign Revised Deadline: Warning #${selectedWarningToRevise?.warning_id}`}
      >
        <form onSubmit={handleAssignRevisedDeadline} className="modal-form">
          <p className="modal-rule-note">
            Target: <strong>{selectedWarningToRevise?.target_user_name || selectedWarningToRevise?.target_group_name}</strong>
            <br />
            Deficit: {selectedWarningToRevise?.reason}
          </p>

          <Input
            type="date"
            label="New Revised Deadline *"
            value={revisedDeadlineDate}
            onChange={(e) => setRevisedDeadlineDate(e.target.value)}
            required
          />

          <p className="modal-rule-note">
            Assigning a revised deadline will update the active task delivery schedule and create an immutable audit record in the compliance log.
          </p>

          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowReviseModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Confirm Revised Deadline
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
