import React, { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Calendar,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Play,
  Send,
  MessageSquare,
  Eye,
  RefreshCw,
  User as UserIcon,
  Users as UsersIcon
} from 'lucide-react'
import {
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  Modal,
  Pagination,
  Alert,
  Skeleton,
  EmptyState
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { tasksApi, teamsApi, usersApi } from '../services/api'
import type {
  Task,
  TaskProof,
  Review,
  TeamSummary,
  UserSummary,
  TaskStatus
} from '../types/api'
import './TasksView.css'

export const TasksView: React.FC = () => {
  const { user, roleTier } = useAuth()

  // Task listing & filtering state
  const [tasks, setTasks] = useState<Task[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(20)
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Creation modal state (Tier 1-3)
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [createTitle, setCreateTitle] = useState<string>('')
  const [createDescription, setCreateDescription] = useState<string>('')
  const [createDeadline, setCreateDeadline] = useState<string>('')
  const [createAssignType, setCreateAssignType] = useState<'individual' | 'team'>('individual')
  const [createAssigneeId, setCreateAssigneeId] = useState<string>('')
  const [createTeamId, setCreateTeamId] = useState<string>('')
  const [createPriority, setCreatePriority] = useState<string>('Medium')
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Detail / Inspector drawer modal
  const [inspectTask, setInspectTask] = useState<Task | null>(null)
  const [inspectProofs, setInspectProofs] = useState<TaskProof[]>([])
  const [inspectReviews, setInspectReviews] = useState<Review[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false)

  // Member submission modal state
  const [isSubmitOpen, setIsSubmitOpen] = useState<boolean>(false)
  const [submitTaskId, setSubmitTaskId] = useState<number | null>(null)
  const [githubLink, setGithubLink] = useState<string>('')
  const [screenshots, setScreenshots] = useState<string>('')
  const [submitDescription, setSubmitDescription] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Review modal state (Tier 1-4)
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false)
  const [reviewTaskId, setReviewTaskId] = useState<number | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'Approved' | 'Changes Requested'>('Approved')
  const [reviewFeedback, setReviewFeedback] = useState<string>('')
  const [isReviewing, setIsReviewing] = useState<boolean>(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Metadata for task creation
  const [availableUsers, setAvailableUsers] = useState<UserSummary[]>([])
  const [availableTeams, setAvailableTeams] = useState<TeamSummary[]>([])

  const loadTasks = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await tasksApi.getTasks({
        status: statusFilter,
        search: searchQuery.trim() || undefined,
        overdue: overdueOnly,
        page
      })
      setTasks(res.results || [])
      setTotalCount(res.count || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load tasks.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [statusFilter, overdueOnly, page])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadTasks()
  }

  // Load assignees and teams when opening create modal
  const handleOpenCreateModal = async () => {
    setIsCreateOpen(true)
    setCreateError(null)
    try {
      const [usersRes, teamsRes] = await Promise.all([
        usersApi.getUsers(),
        teamsApi.getTeams()
      ])
      setAvailableUsers(usersRes.results || [])
      setAvailableTeams(teamsRes.results || [])
    } catch (err: any) {
      console.error('Error loading task assignment targets', err)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!createTitle.trim()) {
      setCreateError('Task title is required.')
      return
    }
    if (!createDeadline) {
      setCreateError('Deadline is required.')
      return
    }

    if (createAssignType === 'individual' && !createAssigneeId) {
      setCreateError('Please select an individual member to assign.')
      return
    }
    if (createAssignType === 'team' && !createTeamId) {
      setCreateError('Please select a team to assign.')
      return
    }

    setIsCreating(true)
    try {
      const deadlineIso = createDeadline.includes('T')
        ? new Date(createDeadline).toISOString()
        : new Date(`${createDeadline}T23:59:59`).toISOString()

      await tasksApi.createTask({
        title: createTitle.trim(),
        description: createDescription.trim(),
        deadline: deadlineIso,
        assigned_to: createAssignType === 'individual' ? Number(createAssigneeId) : null,
        team: createAssignType === 'team' ? Number(createTeamId) : null,
        priority: createPriority
      })

      setSuccessBanner(`Task '${createTitle}' was created successfully.`)
      setIsCreateOpen(false)
      // Reset form
      setCreateTitle('')
      setCreateDescription('')
      setCreateDeadline('')
      setCreateAssigneeId('')
      setCreateTeamId('')
      loadTasks()
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create task.')
    } finally {
      setIsCreating(false)
    }
  }

  // Open inspect task drawer
  const handleInspect = async (task: Task) => {
    setInspectTask(task)
    setIsLoadingDetails(true)
    try {
      const [proofs, reviews] = await Promise.all([
        tasksApi.getTaskSubmissions(task.task_id),
        tasksApi.getTaskReviews(task.task_id)
      ])
      setInspectProofs(proofs || [])
      setInspectReviews(reviews || [])
    } catch (err) {
      console.error('Failed to load proofs/reviews', err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Member Action: Start Task
  const handleStartTask = async (taskId: number) => {
    try {
      const updated = await tasksApi.startTask(taskId)
      setSuccessBanner(`Task #${taskId} is now In Progress.`)
      setTasks((prev) => prev.map((t) => (t.task_id === taskId ? updated : t)))
      if (inspectTask && inspectTask.task_id === taskId) {
        setInspectTask(updated)
      }
    } catch (err: any) {
      setError(err?.message || 'Could not start task.')
    }
  }

  // Member Action: Open Submit Modal
  const handleOpenSubmit = (taskId: number) => {
    setSubmitTaskId(taskId)
    setGithubLink('')
    setScreenshots('')
    setSubmitDescription('')
    setSubmitError(null)
    setIsSubmitOpen(true)
  }

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submitTaskId) return
    setSubmitError(null)

    if (!githubLink.trim() && !screenshots.trim() && !submitDescription.trim()) {
      setSubmitError('Please provide at least one evidence field: GitHub repository link, screenshot URL, or description.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await tasksApi.submitProof(submitTaskId, {
        github_link: githubLink.trim() || undefined,
        screenshots: screenshots.trim() || undefined,
        description: submitDescription.trim() || undefined
      })

      setSuccessBanner(res.message || 'Evidence submitted successfully! Task is now under review.')
      setIsSubmitOpen(false)
      loadTasks()
      if (inspectTask && inspectTask.task_id === submitTaskId) {
        handleInspect(inspectTask)
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit proof.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reviewer Action: Open Review Modal
  const handleOpenReview = (taskId: number) => {
    setReviewTaskId(taskId)
    setReviewDecision('Approved')
    setReviewFeedback('')
    setReviewError(null)
    setIsReviewOpen(true)
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewTaskId) return
    setReviewError(null)

    if (reviewDecision === 'Changes Requested' && !reviewFeedback.trim()) {
      setReviewError('Feedback is required when requesting changes to explain what needs correction.')
      return
    }

    setIsReviewing(true)
    try {
      const res = await tasksApi.reviewTask(reviewTaskId, {
        decision: reviewDecision,
        feedback: reviewFeedback.trim()
      })

      const ptsMsg = res.points_awarded > 0 ? ` (+${res.points_awarded} pts awarded)` : ''
      setSuccessBanner(`${res.message}${ptsMsg}`)
      setIsReviewOpen(false)
      loadTasks()
      if (inspectTask && inspectTask.task_id === reviewTaskId) {
        handleInspect(inspectTask)
      }
    } catch (err: any) {
      setReviewError(err?.message || 'Review submission failed.')
    } finally {
      setIsReviewing(false)
    }
  }

  // Check if current user is assigned to a given task
  const isUserAssigned = (task: Task) => {
    if (!user) return false
    return (
      task.assigned_to?.user_id === user.user_id ||
      (task.team && user.team_id === task.team.team_id)
    )
  }

  // Check anti-self-review and inspection-only guard
  const canUserReviewTask = (task: Task) => {
    if (!user) return false
    const userRole = user.role?.name || user.role_name || ''
    // Requirement 2: Director's monitored tasks must be inspection-only
    if (user.hierarchy_level === 2 || userRole === 'Director of Core Operations') return false
    if (roleTier > 4) return false // Tier 5 members cannot review
    // Reviewer cannot review a task assigned to them
    if (task.assigned_to?.user_id === user.user_id) return false
    // Reviewer cannot review their own submission proof
    if (task.latest_proof && task.latest_proof.submitted_by?.user_id === user.user_id) return false
    return true
  }

  return (
    <div className="tasks-container">
      {/* View Header */}
      <div className="tasks-header">
        <div>
          <h1 className="tasks-title">Task Management & Allocations</h1>
          <p className="tasks-subtitle">
            {roleTier <= 2
              ? 'Executive task directory, state machine management, and community oversight.'
              : roleTier <= 4
              ? 'Lead task allocation, member submissions, and quality review queue.'
              : 'Your assigned community deliverables, submission uploads, and review feedback.'}
          </p>
        </div>

        <div className="tasks-actions-header">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTasks}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          {roleTier <= 3 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              leftIcon={<Plus size={16} />}
            >
              Allocate New Task
            </Button>
          )}
        </div>
      </div>

      {successBanner && (
        <Alert
          variant="success"
          title="Operation Completed"
          description={successBanner}
          onClose={() => setSuccessBanner(null)}
          className="mb-4"
        />
      )}

      {error && (
        <Alert
          variant="danger"
          title="Error"
          description={error}
          onClose={() => setError(null)}
          className="mb-4"
        />
      )}

      {/* Filter and Search Bar */}
      <Card className="filter-card">
        <CardContent className="filter-card-content">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <Input
              placeholder="Search by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={16} />}
              className="search-input"
            />
            <Button type="submit" variant="secondary" size="md">
              Search
            </Button>
          </form>

          <div className="filter-selectors">
            <div className="status-select-wrap">
              <Filter size={14} className="filter-icon" />
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Submitted">Submitted (In Review)</option>
                <option value="Approved">Approved</option>
                <option value="Changes Requested">Changes Requested</option>
              </Select>
            </div>

            <label className="overdue-checkbox-label">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => {
                  setOverdueOnly(e.target.checked)
                  setPage(1)
                }}
              />
              <span>Overdue Only</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Task Listing Table */}
      <Card>
        <CardContent className="table-card-content">
          {isLoading ? (
            <div className="table-loading-skeleton">
              <Skeleton height="40px" />
              <Skeleton height="56px" />
              <Skeleton height="56px" />
              <Skeleton height="56px" />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<AlertCircle size={32} />}
              title="No Tasks Found"
              description="No tasks match the selected filters or search parameters."
              action={
                roleTier <= 3 ? (
                  <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
                    Create a Task
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="table-wrapper">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Allocation</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead style={{ textAlign: 'right' }}>Workflow Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {tasks.map((task) => {
                    const assigned = isUserAssigned(task)
                    const canReview = canUserReviewTask(task)

                    return (
                      <TableRow key={task.task_id}>
                        <TableCell>
                          <div className="task-title-cell">
                            <span className="task-title-text">{task.title}</span>
                            <span className="task-priority-tag">{task.priority}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.assigned_to ? (
                            <span className="allocation-pill user">
                              <UserIcon size={12} /> {task.assigned_to.name}
                            </span>
                          ) : task.team ? (
                            <span className="allocation-pill team">
                              <UsersIcon size={12} /> {task.team.name}
                            </span>
                          ) : (
                            <span className="text-muted">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="deadline-text">
                            <Calendar size={12} /> {task.deadline_display || new Date(task.deadline).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge status={task.status as TaskStatus}>{task.status}</Badge>
                        </TableCell>
                        <TableCell style={{ textAlign: 'right' }}>
                          <div className="table-actions-cell">
                            {/* Inspect Detail */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInspect(task)}
                              title="Inspect Details"
                              leftIcon={<Eye size={14} />}
                            >
                              Inspect
                            </Button>

                            {/* Start Task (Assigned or Changes Requested) */}
                            {assigned && (task.status === 'Assigned' || task.status === 'Changes Requested') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartTask(task.task_id)}
                                leftIcon={<Play size={12} />}
                              >
                                Start
                              </Button>
                            )}

                            {/* Submit Proof (In Progress or Changes Requested) */}
                            {assigned && (task.status === 'In Progress' || task.status === 'Changes Requested') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenSubmit(task.task_id)}
                                leftIcon={<Send size={12} />}
                              >
                                Submit Proof
                              </Button>
                            )}

                            {/* Review Button (Submitted status, Tier 1-4) */}
                            {task.status === 'Submitted' && roleTier <= 4 && (
                              canReview ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleOpenReview(task.task_id)}
                                  leftIcon={<CheckCircle size={12} />}
                                >
                                  Review
                                </Button>
                              ) : (
                                <span className="self-review-pill" title="Self-review is strictly forbidden.">
                                  Self Submission
                                </span>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}

          {totalCount > pageSize && (
            <div className="table-pagination-footer">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(totalCount / pageSize)}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Creation Modal (Tier 1-3) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Allocate New Community Task"
        size="lg"
      >
        <form onSubmit={handleCreateTask} className="modal-form-layout">
          {createError && (
            <Alert variant="danger" title="Validation Notice" description={createError} />
          )}

          <Input
            label="Task Title *"
            placeholder="e.g. Implement Responsive Sidebar Shell"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            required
          />

          <Textarea
            label="Task Description"
            placeholder="Provide clear technical specifications, acceptance criteria, and expectations..."
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
            rows={3}
          />

          <div className="form-row-grid">
            <Input
              type="date"
              label="Submission Deadline *"
              value={createDeadline}
              onChange={(e) => setCreateDeadline(e.target.value)}
              required
            />

            <Select
              label="Priority Level"
              value={createPriority}
              onChange={(e) => setCreatePriority(e.target.value)}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </Select>
          </div>

          <div className="assignment-type-group">
            <label className="input-label">Assignment Target *</label>
            <div className="radio-group-inline">
              <label>
                <input
                  type="radio"
                  name="assignType"
                  value="individual"
                  checked={createAssignType === 'individual'}
                  onChange={() => setCreateAssignType('individual')}
                />
                <span>Individual Member</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="assignType"
                  value="team"
                  checked={createAssignType === 'team'}
                  onChange={() => setCreateAssignType('team')}
                />
                <span>Entire Team</span>
              </label>
            </div>

            {createAssignType === 'individual' ? (
              <Select
                label="Select Community Member *"
                value={createAssigneeId}
                onChange={(e) => setCreateAssigneeId(e.target.value)}
                required
              >
                <option value="">-- Choose Member --</option>
                {availableUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.name} ({u.role?.name || u.role_name || 'Member'}) - {u.email}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                label="Select Target Team *"
                value={createTeamId}
                onChange={(e) => setCreateTeamId(e.target.value)}
                required
              >
                <option value="">-- Choose Team --</option>
                {availableTeams.map((t) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.name} ({t.type} Team, {t.member_count} members)
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="modal-button-footer">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isCreating}
            >
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Member Evidence Submission Modal */}
      <Modal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        title="Submit Deliverable Evidence"
        size="md"
      >
        <form onSubmit={handleSubmitProof} className="modal-form-layout">
          {submitError && (
            <Alert variant="danger" title="Submission Error" description={submitError} />
          )}

          <p className="modal-note-text">
            Submit verifiable proof of completed work. Upon submission, task status advances to
            <strong> Submitted</strong> and enters the reviewer verification queue.
          </p>

          <Input
            label="GitHub Repository / Pull Request Link"
            placeholder="https://github.com/organization/repo/pull/12"
            value={githubLink}
            onChange={(e) => setGithubLink(e.target.value)}
          />

          <Input
            label="Screenshot or Demo URL(s)"
            placeholder="https://imgur.com/demo.png or cloud storage link"
            value={screenshots}
            onChange={(e) => setScreenshots(e.target.value)}
          />

          <Textarea
            label="Implementation Notes / Description"
            placeholder="Detail how the criteria were satisfied, tests run, or special context for reviewers..."
            value={submitDescription}
            onChange={(e) => setSubmitDescription(e.target.value)}
            rows={4}
          />

          <div className="modal-button-footer">
            <Button type="button" variant="ghost" onClick={() => setIsSubmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting} leftIcon={<Send size={14} />}>
              Submit Evidence
            </Button>
          </div>
        </form>
      </Modal>

      {/* Official / Lead Review Modal */}
      <Modal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title="Conduct Official Task Review"
        size="md"
      >
        <form onSubmit={handleReviewSubmit} className="modal-form-layout">
          {reviewError && (
            <Alert variant="danger" title="Review Error" description={reviewError} />
          )}

          <div className="review-decision-group">
            <label className="input-label">Review Decision *</label>
            <div className="decision-buttons-grid">
              <button
                type="button"
                className={`decision-btn approved ${reviewDecision === 'Approved' ? 'active' : ''}`}
                onClick={() => setReviewDecision('Approved')}
              >
                <CheckCircle size={18} />
                <span>Approve (+10 Pts)</span>
              </button>
              <button
                type="button"
                className={`decision-btn changes ${reviewDecision === 'Changes Requested' ? 'active' : ''}`}
                onClick={() => setReviewDecision('Changes Requested')}
              >
                <MessageSquare size={18} />
                <span>Request Changes</span>
              </button>
            </div>
          </div>

          <Textarea
            label={reviewDecision === 'Changes Requested' ? 'Mandatory Feedback *' : 'Reviewer Feedback (Optional)'}
            placeholder={
              reviewDecision === 'Changes Requested'
                ? 'Clearly explain what must be corrected or supplemented before approval...'
                : 'Commend achievements or note positive feedback...'
            }
            value={reviewFeedback}
            onChange={(e) => setReviewFeedback(e.target.value)}
            rows={4}
            required={reviewDecision === 'Changes Requested'}
          />

          <div className="modal-button-footer">
            <Button type="button" variant="ghost" onClick={() => setIsReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={reviewDecision === 'Approved' ? 'success' : 'danger'}
              isLoading={isReviewing}
            >
              Submit {reviewDecision}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Inspection Drawer Modal */}
      {inspectTask && (
        <Modal
          isOpen={!!inspectTask}
          onClose={() => setInspectTask(null)}
          title={`Task #${inspectTask.task_id}: ${inspectTask.title}`}
          size="lg"
        >
          <div className="inspect-drawer-content">
            <div className="inspect-meta-banner">
              <Badge status={inspectTask.status as TaskStatus}>{inspectTask.status}</Badge>
              <span className="inspect-priority">Priority: {inspectTask.priority}</span>
              <span className="inspect-deadline">
                Deadline: {inspectTask.deadline_display || new Date(inspectTask.deadline).toLocaleDateString()}
              </span>
            </div>

            <div className="inspect-section">
              <h4>Description & Objectives</h4>
              <p className="inspect-description">
                {inspectTask.description || 'No description provided.'}
              </p>
            </div>

            <div className="inspect-section">
              <h4>Allocation Information</h4>
              <p>
                {inspectTask.assigned_to
                  ? `Assigned to: ${inspectTask.assigned_to.name} (${inspectTask.assigned_to.email})`
                  : inspectTask.team
                  ? `Assigned to Team: ${inspectTask.team.name}`
                  : 'Unassigned'}
              </p>
              <p className="text-muted">
                Created by: {inspectTask.created_by?.name} on{' '}
                {new Date(inspectTask.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Proofs Submissions Section */}
            <div className="inspect-section">
              <h4>Submitted Proofs ({inspectProofs.length})</h4>
              {isLoadingDetails ? (
                <Skeleton height="60px" />
              ) : inspectProofs.length === 0 ? (
                <p className="text-muted">No evidence submitted yet.</p>
              ) : (
                <div className="proofs-history-list">
                  {inspectProofs.map((proof) => (
                    <div key={proof.proof_id} className="proof-card">
                      <div className="proof-header">
                        <span className="proof-submitter">
                          By {proof.submitted_by?.name} on {new Date(proof.submitted_at).toLocaleString()}
                        </span>
                      </div>
                      {proof.github_link && (
                        <p className="proof-link">
                          <strong>GitHub: </strong>
                          <a href={proof.github_link} target="_blank" rel="noopener noreferrer">
                            {proof.github_link} <ExternalLink size={12} />
                          </a>
                        </p>
                      )}
                      {proof.screenshots && (
                        <p className="proof-link">
                          <strong>Screenshots: </strong>
                          <a href={proof.screenshots} target="_blank" rel="noopener noreferrer">
                            {proof.screenshots} <ExternalLink size={12} />
                          </a>
                        </p>
                      )}
                      {proof.description && (
                        <p className="proof-desc">{proof.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews History Section */}
            <div className="inspect-section">
              <h4>Official Reviews ({inspectReviews.length})</h4>
              {isLoadingDetails ? (
                <Skeleton height="60px" />
              ) : inspectReviews.length === 0 ? (
                <p className="text-muted">No official reviews recorded yet.</p>
              ) : (
                <div className="reviews-history-list">
                  {inspectReviews.map((rev) => (
                    <div key={rev.review_id} className={`review-card ${rev.decision.toLowerCase().replace(' ', '-')}`}>
                      <div className="review-header">
                        <span className="reviewer-name">Reviewed by {rev.reviewer?.name}</span>
                        <Badge status={rev.decision as TaskStatus}>{rev.decision}</Badge>
                      </div>
                      <p className="review-feedback">{rev.feedback || 'No written feedback provided.'}</p>
                      <span className="review-date">{new Date(rev.reviewed_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-button-footer">
              <Button variant="secondary" onClick={() => setInspectTask(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
