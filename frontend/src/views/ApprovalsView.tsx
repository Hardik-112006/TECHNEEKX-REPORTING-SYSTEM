import React, { useState, useEffect } from 'react'
import {
  RotateCw,
  Plus,
  ShieldCheck,
  History
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Alert } from '../components/ui/Alert'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../context/AuthContext'
import { approvalsApi } from '../services/api'
import type { ApprovalWorkflow } from '../types/api'
import './ApprovalsView.css'

export const ApprovalsView: React.FC = () => {
  const { user, roleTier } = useAuth()
  const isReviewer = roleTier <= 3

  const [activeTab, setActiveTab] = useState<'my_queue' | 'all' | 'my_submissions'>(
    isReviewer ? 'my_queue' : 'my_submissions'
  )
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  // Decision Modal
  const [selectedWf, setSelectedWf] = useState<ApprovalWorkflow | null>(null)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [decision, setDecision] = useState<'Approved' | 'Changes Requested' | 'Rejected'>('Approved')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Resubmit Modal
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const [resubmitNotes, setResubmitNotes] = useState('')

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    content_type: 'event_proposal',
    object_id: 1,
    description: '',
    total_stages: 2
  })

  // Expanded audit trails
  const [expandedAudits, setExpandedAudits] = useState<Record<number, boolean>>({})

  useEffect(() => {
    loadWorkflows()
  }, [activeTab])

  const loadWorkflows = async () => {
    setLoading(true)
    setStatusMessage(null)
    try {
      let res
      if (activeTab === 'my_queue') {
        res = await approvalsApi.getWorkflows({ my_queue: true })
      } else if (activeTab === 'my_submissions') {
        res = await approvalsApi.getWorkflows({ submitted_by_me: true })
      } else {
        res = await approvalsApi.getWorkflows()
      }
      setWorkflows(Array.isArray(res) ? res : res.results || [])
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to load approval workflows.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWf) return
    setIsSubmitting(true)
    try {
      await approvalsApi.submitDecision(selectedWf.workflow_id, {
        decision,
        feedback
      })
      setStatusMessage({
        type: 'success',
        text: `Stage ${selectedWf.current_stage} decision "${decision}" recorded successfully.`
      })
      setShowDecisionModal(false)
      setFeedback('')
      loadWorkflows()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to record decision.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWf) return
    setIsSubmitting(true)
    try {
      await approvalsApi.resubmit(selectedWf.workflow_id, { notes: resubmitNotes })
      setStatusMessage({
        type: 'success',
        text: `Workflow "${selectedWf.title}" resubmitted for Stage 1 evaluation.`
      })
      setShowResubmitModal(false)
      setResubmitNotes('')
      loadWorkflows()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to resubmit proposal.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await approvalsApi.createWorkflow(createForm)
      setStatusMessage({
        type: 'success',
        text: `Multi-level approval workflow "${createForm.title}" initialized.`
      })
      setShowCreateModal(false)
      setCreateForm({
        title: '',
        content_type: 'event_proposal',
        object_id: 1,
        description: '',
        total_stages: 2
      })
      loadWorkflows()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to initialize workflow.' })
    }
  }

  const toggleAudit = (id: number) => {
    setExpandedAudits(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge variant="success">Approved</Badge>
      case 'Changes Requested':
        return <Badge variant="warning">Revisions Needed</Badge>
      case 'Rejected':
        return <Badge variant="danger">Rejected</Badge>
      case 'Pending Stage 1':
        return <Badge variant="primary">Stage 1: Lead Review</Badge>
      case 'Pending Stage 2':
        return <Badge variant="outline">Stage 2: Official Sign-off</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const canCurrentUserReview = (wf: ApprovalWorkflow) => {
    if (!user) return false
    // Anti-self review check
    if (wf.submitter === user.user_id) return false
    if (wf.status === 'Approved' || wf.status === 'Rejected' || wf.status === 'Changes Requested') return false

    if (wf.current_stage === 1) return roleTier <= 3
    if (wf.current_stage === 2) return roleTier <= 2
    return false
  }

  return (
    <div className="approvals-view">
      {/* Header */}
      <div className="approvals-header">
        <div>
          <h2 className="text-xl font-bold text-primary">Multi-Level Governance & Approvals</h2>
          <p className="text-secondary text-sm">
            Sequential multi-stage verification: Technical Lead Review (Stage 1) → Executive Budget Ratification (Stage 2).
          </p>
        </div>

        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} style={{ marginRight: 6 }} />
          Initialize Workflow
        </Button>
      </div>

      {statusMessage && (
        <Alert variant={statusMessage.type} onClose={() => setStatusMessage(null)}>
          {statusMessage.text}
        </Alert>
      )}

      {/* Tabs */}
      <div className="approvals-nav-tabs">
        {isReviewer && (
          <button
            className={`approvals-tab-btn ${activeTab === 'my_queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_queue')}
          >
            My Review Queue ({isReviewer ? workflows.filter(w => canCurrentUserReview(w)).length : 0})
          </button>
        )}
        <button
          className={`approvals-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Active Governance Workflows
        </button>
        <button
          className={`approvals-tab-btn ${activeTab === 'my_submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('my_submissions')}
        >
          My Submitted Proposals
        </button>
      </div>

      {/* Workflow Items List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          title="No Approval Workflows in this View"
          description="Initialize an approval workflow for campus event proposals, sponsorships, legal MoUs, or major deliverables."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {workflows.map(wf => (
            <Card key={wf.workflow_id} className="workflow-card">
              <div className="wf-header">
                <div className="wf-title-block">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{wf.content_type.replace('_', ' ').toUpperCase()}</Badge>
                    <span className="text-xs text-secondary">#{wf.workflow_id}</span>
                  </div>
                  <h3>{wf.title}</h3>
                  <div className="wf-meta">
                    <span>Submitted by: <b>{wf.submitter_name}</b></span>
                    <span>Date: {new Date(wf.created_at).toLocaleDateString()}</span>
                    <span>Target ID: #{wf.object_id}</span>
                  </div>
                </div>

                <div>{getStatusBadge(wf.status)}</div>
              </div>

              {wf.description && (
                <p className="text-sm text-secondary bg-surface-bg p-3 rounded-md border border-border">
                  {wf.description}
                </p>
              )}

              {/* Multi-Stage Visual Step Progress Tracker */}
              <div className="stage-tracker-container">
                <div
                  className={`stage-step ${
                    wf.status === 'Approved' || wf.current_stage > 1 ? 'completed' : wf.current_stage === 1 ? 'active' : ''
                  }`}
                >
                  <div className="stage-step-num">
                    {wf.status === 'Approved' || wf.current_stage > 1 ? '✓' : '1'}
                  </div>
                  <span>Stage 1: Lead Technical Review</span>
                </div>

                <span className="stage-arrow">→</span>

                <div
                  className={`stage-step ${
                    wf.status === 'Approved' ? 'completed' : wf.current_stage === 2 ? 'active' : ''
                  }`}
                >
                  <div className="stage-step-num">
                    {wf.status === 'Approved' ? '✓' : '2'}
                  </div>
                  <span>Stage 2: Official Ratification</span>
                </div>
              </div>

              {/* Historical Audit Trail Accordion */}
              {wf.stage_history && wf.stage_history.length > 0 && (
                <div className="wf-audit-trail">
                  <button
                    type="button"
                    className="text-xs text-primary font-semibold flex items-center gap-1 cursor-pointer bg-none border-none p-0"
                    onClick={() => toggleAudit(wf.workflow_id)}
                  >
                    <History size={14} />
                    <span>
                      {expandedAudits[wf.workflow_id] ? 'Hide Audit Decisions' : `View Decisions History (${wf.stage_history.length})`}
                    </span>
                  </button>

                  {expandedAudits[wf.workflow_id] && (
                    <div className="mt-2 flex flex-col gap-2">
                      {wf.stage_history.map(audit => (
                        <div key={audit.audit_id} className="audit-entry">
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-primary">
                                {audit.stage_name} — {audit.reviewer_name} ({audit.reviewer_role})
                              </span>
                              <Badge
                                variant={
                                  audit.decision === 'Approved'
                                    ? 'success'
                                    : audit.decision === 'Changes Requested'
                                    ? 'warning'
                                    : 'danger'
                                }
                                size="sm"
                              >
                                {audit.decision}
                              </Badge>
                            </div>
                            {audit.feedback && (
                              <div className="audit-feedback">"{audit.feedback}"</div>
                            )}
                            <span className="text-xs text-secondary mt-1 block">
                              Decided on {new Date(audit.decided_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions Toolbar */}
              <div className="wf-actions-row">
                {canCurrentUserReview(wf) && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedWf(wf)
                      setDecision('Approved')
                      setFeedback('')
                      setShowDecisionModal(true)
                    }}
                  >
                    <ShieldCheck size={15} style={{ marginRight: 6 }} />
                    Review & Record Decision (Stage {wf.current_stage})
                  </Button>
                )}

                {wf.status === 'Changes Requested' && user?.user_id === wf.submitter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedWf(wf)
                      setResubmitNotes('')
                      setShowResubmitModal(true)
                    }}
                  >
                    <RotateCw size={15} style={{ marginRight: 6 }} />
                    Submit Revisions
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      <Modal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title={`Review Stage ${selectedWf?.current_stage}: ${selectedWf?.title}`}
      >
        <form onSubmit={handleDecisionSubmit} className="modal-form-grid">
          <div className="form-group">
            <label className="form-label">Review Decision *</label>
            <select
              className="form-select"
              value={decision}
              onChange={e => setDecision(e.target.value as any)}
            >
              <option value="Approved">
                Approve {selectedWf?.current_stage === selectedWf?.total_stages ? '(Final Ratification)' : '(Advance to Stage 2)'}
              </option>
              <option value="Changes Requested">Changes Requested (Return to Submitter)</option>
              <option value="Rejected">Reject Proposal</option>
            </select>
          </div>

          <Textarea
            label={decision !== 'Approved' ? 'Mandatory Review Feedback *' : 'Official Remarks / Notes'}
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="State your technical review findings, budget adjustments, or justification..."
            rows={4}
            required={decision !== 'Approved'}
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" type="button" onClick={() => setShowDecisionModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Save Official Decision'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resubmit Modal */}
      <Modal
        isOpen={showResubmitModal}
        onClose={() => setShowResubmitModal(false)}
        title={`Resubmit Revisions: ${selectedWf?.title}`}
      >
        <form onSubmit={handleResubmit} className="modal-form-grid">
          <p className="text-sm text-secondary">
            Your revisions will be entered back into the Stage 1 review queue for evaluation.
          </p>

          <Textarea
            label="Revision Notes & Clarifications"
            value={resubmitNotes}
            onChange={e => setResubmitNotes(e.target.value)}
            placeholder="Summarize the adjustments made to address reviewer feedback..."
            rows={4}
            required
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" type="button" onClick={() => setShowResubmitModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Resubmit for Review'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Workflow Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Initialize Multi-Level Approval Workflow"
      >
        <form onSubmit={handleCreateWorkflow} className="modal-form-grid">
          <Input
            label="Proposal / Workflow Title *"
            value={createForm.title}
            onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="e.g. AI & Cloud Developer Conference 2027"
            required
          />

          <div className="form-group">
            <label className="form-label">Content Domain</label>
            <select
              className="form-select"
              value={createForm.content_type}
              onChange={e => setCreateForm({ ...createForm, content_type: e.target.value })}
            >
              <option value="event_proposal">Event Proposal</option>
              <option value="sponsorship_proposal">Sponsorship Deal</option>
              <option value="mou_document">Institutional MoU</option>
              <option value="task_submission">Major Task Deliverable</option>
            </select>
          </div>

          <Input
            label="Associated Entity ID *"
            type="number"
            value={createForm.object_id}
            onChange={e => setCreateForm({ ...createForm, object_id: parseInt(e.target.value, 10) || 1 })}
            required
          />

          <Textarea
            label="Description & Objectives *"
            value={createForm.description}
            onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
            placeholder="Detail the deliverables, campus partners involved, and expected impact..."
            rows={3}
            required
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Start Governance Workflow
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
