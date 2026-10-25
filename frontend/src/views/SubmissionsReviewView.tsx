import React, { useState, useEffect } from 'react'
import {
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Eye,
  ShieldCheck
} from 'lucide-react'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  Button,
  Badge,
  Modal,
  Textarea,
  Skeleton,
  EmptyState,
  Alert
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { submissionsApi, tasksApi } from '../services/api'
import type { TaskProof, Task, UserSummary } from '../types/api'
import './SubmissionsReviewView.css'

export interface SubmissionsReviewViewProps {
  onNavigate?: (navId: string) => void
}

export const SubmissionsReviewView: React.FC<SubmissionsReviewViewProps> = ({ onNavigate }) => {
  const { user, roleTier } = useAuth()
  const userRole = user?.role?.name || user?.role_name || ''
  const isDirectorOfOperations =
    user?.hierarchy_level === 3 ||
    user?.hierarchy_level === 2 ||
    userRole === 'Director of Core Operations' ||
    user?.category === 'Director of Core Operations'

  // Requirement 2: Director's monitored tasks must be inspection-only, with no approve, reject, or submission-review actions.
  const isReviewer = !isDirectorOfOperations && (
    user?.hierarchy_level === 1 ||
    ['Founder', 'Chairman', 'Managing Director', 'President', 'Official', 'Core Team Lead', 'Core Lead'].includes(userRole) ||
    (roleTier <= 3 && roleTier !== 2)
  )

  const [submissions, setSubmissions] = useState<TaskProof[]>([])
  const [tasksMap, setTasksMap] = useState<Record<number, Task>>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Approved' | 'Changes Requested'>('All')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')

  // Review Modal State
  const [selectedProof, setSelectedProof] = useState<TaskProof | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [decision, setDecision] = useState<'Approved' | 'Changes Requested'>('Approved')
  const [feedback, setFeedback] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // Detail Modal State
  const [detailProof, setDetailProof] = useState<TaskProof | null>(null)

  const getSubmitterRole = (summary?: UserSummary): string => {
    if (!summary) return 'Member'
    if (summary.role_name) return summary.role_name
    if (typeof summary.role === 'object' && summary.role?.name) {
      return String(summary.role.name)
    }
    if (typeof summary.role === 'string') {
      return summary.role
    }
    return 'Member'
  }

  const getSubmitterTeam = (summary?: UserSummary): string => {
    if (!summary) return 'TechNeekX'
    return summary.team_name || summary.group_name || 'TechNeekX'
  }

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 1. Fetch proofs
      const res = await submissionsApi.getAllSubmissions()
      const proofsList: TaskProof[] = Array.isArray(res) ? res : res.results || []
      setSubmissions(proofsList)

      // 2. Fetch tasks to get live status
      try {
        const tasksRes = await tasksApi.getTasks()
        const tList: Task[] = Array.isArray(tasksRes) ? tasksRes : tasksRes.results || []
        const map: Record<number, Task> = {}
        tList.forEach((t) => {
          map[t.task_id] = t
        })
        setTasksMap(map)
      } catch {
        // Fallback to proof.task_status
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load submissions. Please ensure backend is running.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Derive task status: tasksMap ground-truth > proof.task_status > 'Submitted'
  const getEffectiveStatus = (proof: TaskProof): string => {
    if (tasksMap[proof.task_id]) {
      return tasksMap[proof.task_id].status
    }
    return proof.task_status || 'Submitted'
  }

  // Calculate Real Authorized Metrics
  const totalCount = submissions.length
  const pendingCount = submissions.filter((s) => getEffectiveStatus(s) === 'Submitted').length
  const approvedCount = submissions.filter((s) => getEffectiveStatus(s) === 'Approved').length
  const changesRequestedCount = submissions.filter((s) => getEffectiveStatus(s) === 'Changes Requested').length

  // Filter and Sort Submissions
  const filteredSubmissions = submissions.filter((proof) => {
    const status = getEffectiveStatus(proof)

    // Status filter
    if (statusFilter !== 'All' && status !== statusFilter) {
      return false
    }

    // Role filter
    if (roleFilter !== 'All') {
      const submitterRole = getSubmitterRole(proof.submitted_by)
      if (roleFilter === 'Official' && !['Founder', 'Official', 'Director of Core Operations'].includes(submitterRole)) {
        return false
      }
      if (roleFilter === 'Core Team' && !['Core Team Lead', 'Core Lead'].includes(submitterRole)) {
        return false
      }
      if (roleFilter === 'Member' && submitterRole !== 'Member') {
        return false
      }
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const titleMatch = (proof.task_title || '').toLowerCase().includes(q)
      const descMatch = (proof.description || '').toLowerCase().includes(q)
      const nameMatch = (proof.submitted_by?.name || '').toLowerCase().includes(q)
      const emailMatch = (proof.submitted_by?.email || '').toLowerCase().includes(q)
      if (!titleMatch && !descMatch && !nameMatch && !emailMatch) {
        return false
      }
    }

    return true
  }).sort((a, b) => {
    const dateA = new Date(a.submitted_at).getTime()
    const dateB = new Date(b.submitted_at).getTime()
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB
  })

  // Submit Review Workflow
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProof) return

    if (decision === 'Changes Requested' && !feedback.trim()) {
      setBanner({ type: 'danger', text: 'Feedback is required when requesting changes.' })
      return
    }

    setIsSubmittingReview(true)
    setBanner(null)
    try {
      const res = await submissionsApi.reviewTask(selectedProof.task_id, {
        decision,
        feedback: feedback.trim()
      })
      setBanner({
        type: 'success',
        text: `Review recorded: "${decision}". ${res.scoring_info || ''}`
      })
      setShowReviewModal(false)
      setSelectedProof(null)
      setFeedback('')
      // Reload to reflect updated task status and scoring
      await loadData()
    } catch (err: any) {
      setBanner({
        type: 'danger',
        text: err?.message || 'Failed to submit review decision.'
      })
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const openReviewModal = (proof: TaskProof) => {
    setSelectedProof(proof)
    setDecision('Approved')
    setFeedback('')
    setShowReviewModal(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge variant="success" size="sm">Approved (+10 Pts)</Badge>
      case 'Changes Requested':
        return <Badge variant="warning" size="sm">Changes Requested</Badge>
      case 'Submitted':
        return <Badge variant="primary" size="sm">Pending Review</Badge>
      default:
        return <Badge variant="default" size="sm">{status}</Badge>
    }
  }

  return (
    <div className="submissions-review-view">
      {/* Page Header */}
      <div className="submissions-header-row">
        <div className="submissions-header-left">
          <h1 className="submissions-view-title">Submission Review</h1>
          <p className="submissions-view-subtitle">
            Inspect submitted deliverable proofs, verify evidence links, and conduct peer or official reviews.
          </p>
        </div>
        <div className="submissions-header-actions">
          {onNavigate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('tasks')}
            >
              Tasks Board &rarr;
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh Records
          </Button>
        </div>
      </div>

      {banner && (
        <Alert
          variant={banner.type}
          title="Review Status"
          description={banner.text}
          onClose={() => setBanner(null)}
        />
      )}

      {error && (
        <Alert
          variant="danger"
          title="Error Loading Submissions"
          description={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Summary Metrics Cards */}
      <div className="submissions-metrics-grid">
        <Card>
          <div className="metric-card-content">
            <div className="metric-info">
              <span className="metric-label">Total Submissions</span>
              <span className="metric-val">{totalCount}</span>
            </div>
            <div className="metric-icon-box blue">
              <UploadCloud size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="metric-card-content">
            <div className="metric-info">
              <span className="metric-label">Pending Review</span>
              <span className="metric-val">{pendingCount}</span>
            </div>
            <div className="metric-icon-box amber">
              <Clock size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="metric-card-content">
            <div className="metric-info">
              <span className="metric-label">Approved & Scored</span>
              <span className="metric-val">{approvedCount}</span>
            </div>
            <div className="metric-icon-box green">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="metric-card-content">
            <div className="metric-info">
              <span className="metric-label">Corrections Requested</span>
              <span className="metric-val">{changesRequestedCount}</span>
            </div>
            <div className="metric-icon-box red">
              <AlertTriangle size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters Toolbar */}
      <div className="submissions-filter-card">
        <div className="submissions-filter-row">
          <div className="search-filter-input-wrap">
            <Search size={15} className="search-filter-icon" />
            <input
              type="text"
              className="submissions-search-input"
              placeholder="Filter by submitter name or task title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="submissions-select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="Filter by Status"
          >
            <option value="All">All Statuses</option>
            <option value="Submitted">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Changes Requested">Changes Requested</option>
          </select>

          <select
            className="submissions-select-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by Submitter Role"
          >
            <option value="All">All Submitter Roles</option>
            <option value="Official">Officials</option>
            <option value="Core Team">Core Team</option>
            <option value="Member">Members</option>
          </select>

          <select
            className="submissions-select-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort Order"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>

          {(searchQuery || statusFilter !== 'All' || roleFilter !== 'All') && (
            <button
              type="button"
              className="submissions-reset-btn"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('All')
                setRoleFilter('All')
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Submissions Table / Cards */}
      {isLoading ? (
        <Card className="submissions-table-card">
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton height="45px" />
            <Skeleton height="45px" />
            <Skeleton height="45px" />
          </div>
        </Card>
      ) : filteredSubmissions.length === 0 ? (
        <Card className="submissions-table-card">
          <CardContent style={{ padding: '48px 24px', textAlign: 'center' }}>
            <EmptyState
              icon={<UploadCloud size={40} style={{ color: 'var(--color-text-muted)' }} />}
              title="No Submissions Found"
              description={
                submissions.length === 0
                  ? "No task deliverables have been submitted yet. Completed tasks submitted by community members will appear here."
                  : "No submissions match the current search query or filter selection."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="submissions-table-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task & Deliverable</TableHead>
                <TableHead>Submitter</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Evidence Proof</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {filteredSubmissions.map((proof) => {
                const status = getEffectiveStatus(proof)
                const isSelf = proof.submitted_by?.user_id === user?.user_id
                const canReview = isReviewer && status === 'Submitted' && !isSelf
                const submitterRole = getSubmitterRole(proof.submitted_by)
                const submitterTeam = getSubmitterTeam(proof.submitted_by)

                return (
                  <TableRow key={proof.proof_id}>
                    {/* Task Title */}
                    <TableCell>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                          {proof.task_title || `Task #${proof.task_id}`}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          Proof #{proof.proof_id} • Task #{proof.task_id}
                        </span>
                      </div>
                    </TableCell>

                    {/* Submitter */}
                    <TableCell>
                      <div className="submitter-cell">
                        <div className="submitter-avatar-mini">
                          {proof.submitted_by?.name ? proof.submitted_by.name[0].toUpperCase() : 'M'}
                        </div>
                        <div className="submitter-meta">
                          <span className="submitter-name">{proof.submitted_by?.name || 'Community Member'}</span>
                          <span className="submitter-role">
                            {submitterRole} • {submitterTeam}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {new Date(proof.submitted_at).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell>{getStatusBadge(status)}</TableCell>

                    {/* Evidence Proof */}
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {proof.github_link && (
                          <a
                            href={proof.github_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="evidence-link-pill"
                            title={proof.github_link}
                          >
                            <ExternalLink size={12} />
                            <span>GitHub PR</span>
                          </a>
                        )}
                        {proof.screenshots && (
                          <button
                            type="button"
                            className="evidence-link-pill"
                            onClick={() => setDetailProof(proof)}
                            title="View Screenshot Links"
                          >
                            <span>Screenshots</span>
                          </button>
                        )}
                        {!proof.github_link && !proof.screenshots && (
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            Notes only
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell style={{ textAlign: 'right' }}>
                      <div className="actions-cell-row" style={{ justifyContent: 'flex-end' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailProof(proof)}
                          leftIcon={<Eye size={13} />}
                        >
                          Inspect
                        </Button>

                        {isReviewer && (
                          <Button
                            variant={status === 'Submitted' ? 'primary' : 'outline'}
                            size="sm"
                            disabled={!canReview}
                            onClick={() => openReviewModal(proof)}
                            leftIcon={<ShieldCheck size={14} />}
                            title={
                              isSelf
                                ? 'Self-review forbidden: You cannot review your own submission'
                                : status !== 'Submitted'
                                ? `Already evaluated: ${status}`
                                : 'Review Deliverable'
                            }
                          >
                            {status === 'Submitted' ? (isSelf ? 'Self Submission' : 'Review') : 'Evaluated'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Review Workflow Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={`Review Submission — ${selectedProof?.task_title || `Task #${selectedProof?.task_id}`}`}
        size="lg"
      >
        {selectedProof && (
          <form onSubmit={handleReviewSubmit} className="review-modal-content">
            <div className="review-proof-summary-box">
              <div className="proof-detail-row">
                <span className="proof-detail-label">Submitter:</span>
                <span className="proof-detail-val">
                  {selectedProof.submitted_by?.name} ({getSubmitterRole(selectedProof.submitted_by)})
                </span>
              </div>
              <div className="proof-detail-row">
                <span className="proof-detail-label">Submitted At:</span>
                <span className="proof-detail-val">
                  {new Date(selectedProof.submitted_at).toLocaleString()}
                </span>
              </div>
              {selectedProof.github_link && (
                <div className="proof-detail-row">
                  <span className="proof-detail-label">GitHub Link:</span>
                  <a
                    href={selectedProof.github_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-detail-val"
                    style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {selectedProof.github_link} <ExternalLink size={12} />
                  </a>
                </div>
              )}
              {selectedProof.screenshots && (
                <div className="proof-detail-row">
                  <span className="proof-detail-label">Screenshots:</span>
                  <span className="proof-detail-val">{selectedProof.screenshots}</span>
                </div>
              )}
              <div className="proof-detail-row">
                <span className="proof-detail-label">Submitter Notes:</span>
                <span className="proof-detail-val" style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedProof.description || 'No implementation notes provided.'}
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6, display: 'block' }}>
                Review Decision *
              </label>
              <div className="decision-selector-group">
                <div
                  className={`decision-radio-card ${decision === 'Approved' ? 'selected-approve' : ''}`}
                  onClick={() => setDecision('Approved')}
                  role="radio"
                  aria-checked={decision === 'Approved'}
                  tabIndex={0}
                >
                  <div className="decision-radio-header">
                    <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                    <span>Approve (+10 Points)</span>
                  </div>
                  <span className="decision-radio-desc">
                    Deliverable meets requirements. Completes the task and awards 10 points.
                  </span>
                </div>

                <div
                  className={`decision-radio-card ${decision === 'Changes Requested' ? 'selected-changes' : ''}`}
                  onClick={() => setDecision('Changes Requested')}
                  role="radio"
                  aria-checked={decision === 'Changes Requested'}
                  tabIndex={0}
                >
                  <div className="decision-radio-header">
                    <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
                    <span>Request Corrections</span>
                  </div>
                  <span className="decision-radio-desc">
                    Deliverable requires improvements or missing evidence before approval.
                  </span>
                </div>
              </div>
            </div>

            <Textarea
              label={decision === 'Changes Requested' ? 'Correction Feedback * (Mandatory)' : 'Review Notes (Optional)'}
              placeholder={
                decision === 'Changes Requested'
                  ? 'Explain specifically what needs to be fixed or updated in the deliverable...'
                  : 'Add optional feedback or praise for the submitter...'
              }
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              required={decision === 'Changes Requested'}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setShowReviewModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={decision === 'Approved' ? 'primary' : 'outline'}
                isLoading={isSubmittingReview}
              >
                Submit Decision: {decision}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Inspect Detail Modal */}
      <Modal
        isOpen={Boolean(detailProof)}
        onClose={() => setDetailProof(null)}
        title={`Submission Evidence — ${detailProof?.task_title || `Task #${detailProof?.task_id}`}`}
        size="md"
      >
        {detailProof && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="review-proof-summary-box">
              <div className="proof-detail-row">
                <span className="proof-detail-label">Submitter:</span>
                <span className="proof-detail-val">{detailProof.submitted_by?.name}</span>
              </div>
              <div className="proof-detail-row">
                <span className="proof-detail-label">Role & Team:</span>
                <span className="proof-detail-val">
                  {getSubmitterRole(detailProof.submitted_by)} • {getSubmitterTeam(detailProof.submitted_by)}
                </span>
              </div>
              <div className="proof-detail-row">
                <span className="proof-detail-label">Status:</span>
                <span className="proof-detail-val">{getStatusBadge(getEffectiveStatus(detailProof))}</span>
              </div>
              <div className="proof-detail-row">
                <span className="proof-detail-label">Submitted At:</span>
                <span className="proof-detail-val">{new Date(detailProof.submitted_at).toLocaleString()}</span>
              </div>
              {detailProof.github_link && (
                <div className="proof-detail-row">
                  <span className="proof-detail-label">GitHub URL:</span>
                  <a
                    href={detailProof.github_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-detail-val"
                    style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {detailProof.github_link} <ExternalLink size={12} />
                  </a>
                </div>
              )}
              {detailProof.screenshots && (
                <div className="proof-detail-row">
                  <span className="proof-detail-label">Screenshots:</span>
                  <span className="proof-detail-val" style={{ wordBreak: 'break-all' }}>
                    {detailProof.screenshots}
                  </span>
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Implementation Notes
              </h4>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {detailProof.description || 'No detailed implementation notes submitted.'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="primary" onClick={() => setDetailProof(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
