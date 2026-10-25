import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Alert } from '../components/ui/Alert'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { useAuth } from '../context/AuthContext'
import { documentsApi } from '../services/api'
import type {
  ResourceMaterial,
  MouDocument,
  EventProposal,
  SponsorshipProposal,
  CommunityPartner
} from '../types/api'
import './OfficialDocumentsView.css'

export const OfficialDocumentsView: React.FC = () => {
  const { roleTier } = useAuth()
  const isOfficial = roleTier <= 2

  const [activeTab, setActiveTab] = useState<'resources' | 'mous' | 'events' | 'sponsorships' | 'partners'>('resources')
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  // Data states
  const [resources, setResources] = useState<ResourceMaterial[]>([])
  const [mous, setMous] = useState<MouDocument[]>([])
  const [eventProposals, setEventProposals] = useState<EventProposal[]>([])
  const [sponsorships, setSponsorships] = useState<SponsorshipProposal[]>([])
  const [partners, setPartners] = useState<CommunityPartner[]>([])

  // Modal states
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [showMouModal, setShowMouModal] = useState(false)
  const [showMouReviewModal, setShowMouReviewModal] = useState(false)
  const [selectedMou, setSelectedMou] = useState<MouDocument | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showEventReviewModal, setShowEventReviewModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventProposal | null>(null)
  const [showSponsorModal, setShowSponsorModal] = useState(false)
  const [showPartnerModal, setShowPartnerModal] = useState(false)

  // Form states
  const [resourceForm, setResourceForm] = useState({
    title: '',
    category: 'Guide' as 'Guide' | 'Template' | 'Cheatsheet' | 'Brand Asset' | 'Tool',
    description: '',
    file_url: '',
    min_role_tier: 5
  })

  const [mouForm, setMouForm] = useState(() => ({
    organization_name: '',
    signatory_second_party: '',
    validity_start: new Date().toISOString().split('T')[0],
    validity_end: '',
    scope_of_work: ''
  }))

  const [mouReviewForm, setMouReviewForm] = useState({
    status: 'Approved',
    review_notes: ''
  })

  const [eventForm, setEventForm] = useState({
    title: '',
    event_type: 'Workshop',
    target_date: '',
    expected_attendees: 100,
    estimated_budget: 0,
    venue_or_platform: 'TechNeekX Discord & Zoom',
    description: ''
  })

  const [eventReviewForm, setEventReviewForm] = useState({
    decision: 'Approved' as 'Approved' | 'Rejected' | 'Under Review',
    feedback: ''
  })

  const [sponsorForm, setSponsorForm] = useState({
    sponsor_organization: '',
    sponsorship_tier: 'Gold' as 'Title' | 'Platinum' | 'Gold' | 'Silver' | 'Community',
    amount_requested: 1000,
    contact_person: '',
    contact_email: '',
    deliverables_offered: '',
    notes: ''
  })

  const [partnerForm, setPartnerForm] = useState({
    organization_name: '',
    partner_type: 'College Club' as 'College Club' | 'Tech Community' | 'Corporate' | 'Media Partner' | 'Incubator',
    website: '',
    poc_name: '',
    poc_email: '',
    benefits_summary: ''
  })

  const loadTabData = React.useCallback(async () => {
    setLoading(true)
    setStatusMessage(null)
    try {
      if (activeTab === 'resources') {
        const res = await documentsApi.getResources()
        setResources(Array.isArray(res) ? res : res.results || [])
      } else if (activeTab === 'mous') {
        const res = await documentsApi.getMous()
        setMous(Array.isArray(res) ? res : res.results || [])
      } else if (activeTab === 'events') {
        const res = await documentsApi.getEventProposals()
        setEventProposals(Array.isArray(res) ? res : res.results || [])
      } else if (activeTab === 'sponsorships') {
        const res = await documentsApi.getSponsorships()
        setSponsorships(Array.isArray(res) ? res : res.results || [])
      } else if (activeTab === 'partners') {
        const res = await documentsApi.getPartners()
        setPartners(Array.isArray(res) ? res : res.results || [])
      }
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to load official documents data.' })
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadTabData()
  }, [loadTabData])

  const handleResourceDownload = async (resource: ResourceMaterial) => {
    try {
      await documentsApi.trackResourceDownload(resource.id)
      setResources(prev =>
        prev.map(r => (r.id === resource.id ? { ...r, download_count: r.download_count + 1 } : r))
      )
      window.open(resource.file_url, '_blank', 'noopener,noreferrer')
    } catch {
      window.open(resource.file_url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await documentsApi.createResource(resourceForm)
      setStatusMessage({ type: 'success', text: `Resource "${resourceForm.title}" published successfully.` })
      setShowResourceModal(false)
      setResourceForm({ title: '', category: 'Guide', description: '', file_url: '', min_role_tier: 5 })
      loadTabData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to publish resource material.' })
    }
  }

  const handleCreateMou = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await documentsApi.createMou({
        organization_name: mouForm.organization_name,
        signatory_second_party: mouForm.signatory_second_party,
        scope_of_work: mouForm.scope_of_work,
        validity_start: mouForm.validity_start,
        validity_end: mouForm.validity_end
      })
      setStatusMessage({ type: 'success', text: `MoU initialized for "${mouForm.organization_name}".` })
      setShowMouModal(false)
      loadTabData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to create MoU agreement.' })
    }
  }

  const handleReviewMou = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMou) return
    try {
      await documentsApi.reviewMou(selectedMou.id, mouReviewForm)
      setStatusMessage({ type: 'success', text: `MoU status updated to ${mouReviewForm.status}.` })
      setShowMouReviewModal(false)
      loadTabData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to review MoU agreement.' })
    }
  }

  const handleDownloadMouPdf = async (mou: MouDocument) => {
    try {
      const blob = await documentsApi.downloadMouPdf(mou.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MoU_TechNeekX_${mou.organization_name.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setStatusMessage({ type: 'success', text: `Downloaded official MoU PDF for ${mou.organization_name}.` })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to download MoU PDF document.' })
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await documentsApi.createEventProposal(eventForm)
      setStatusMessage({ type: 'success', text: `Event proposal "${eventForm.title}" submitted for official review.` })
      setShowEventModal(false)
      setEventForm({
        title: '',
        event_type: 'Workshop',
        target_date: '',
        expected_attendees: 100,
        estimated_budget: 0,
        venue_or_platform: 'TechNeekX Discord & Zoom',
        description: ''
      })
      loadTabData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to submit event proposal.' })
    }
  }

  const handleReviewEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent) return
    try {
      await documentsApi.reviewEventProposal(selectedEvent.id, eventReviewForm)
      setStatusMessage({ type: 'success', text: `Event proposal decision saved: ${eventReviewForm.decision}.` })
      setShowEventReviewModal(false)
      loadTabData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to update event review.' })
    }
  }

  const handleCreateSponsor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await documentsApi.createSponsorship(sponsorForm)
      setStatusMessage({ type: 'success', text: `Sponsorship pitch for "${sponsorForm.sponsor_organization}" created.` })
      setShowSponsorModal(false)
      loadTabData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to register sponsorship proposal.' })
    }
  }

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await documentsApi.createPartner(partnerForm)
      setStatusMessage({ type: 'success', text: `Community partner "${partnerForm.organization_name}" registered.` })
      setShowPartnerModal(false)
      loadTabData()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to register community partner.' })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Confirmed':
      case 'Active':
      case 'Signed':
        return <Badge variant="success">{status}</Badge>
      case 'Under Review':
      case 'In Review':
      case 'Submitted':
      case 'Proposed':
      case 'Negotiating':
      case 'Pending':
        return <Badge variant="warning">{status}</Badge>
      case 'Rejected':
      case 'Terminated':
      case 'Declined':
      case 'Inactive':
        return <Badge variant="danger">{status}</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <div className="documents-container">
      {/* Top Header */}
      <div className="documents-header">
        <div>
          <h1 className="documents-title">Official Documents & Partnerships</h1>
          <p className="documents-subtitle">
            Community resource repository, legal MoUs, event & sponsorship proposals, and verified partner network.
          </p>
        </div>
        <div className="documents-actions">
          {activeTab === 'resources' && isOfficial && (
            <Button variant="primary" onClick={() => setShowResourceModal(true)}>
              + Publish Resource
            </Button>
          )}
          {activeTab === 'mous' && isOfficial && (
            <Button variant="primary" onClick={() => setShowMouModal(true)}>
              + New MoU Proposal
            </Button>
          )}
          {activeTab === 'events' && (
            <Button variant="primary" onClick={() => setShowEventModal(true)}>
              + Submit Event Proposal
            </Button>
          )}
          {activeTab === 'sponsorships' && (
            <Button variant="primary" onClick={() => setShowSponsorModal(true)}>
              + Add Sponsor Pitch
            </Button>
          )}
          {activeTab === 'partners' && (
            <Button variant="primary" onClick={() => setShowPartnerModal(true)}>
              + Register Partner
            </Button>
          )}
        </div>
      </div>

      {statusMessage && (
        <Alert variant={statusMessage.type} onClose={() => setStatusMessage(null)}>
          {statusMessage.text}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="documents-nav">
        <button
          className={`documents-nav-btn ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          Resource Materials ({resources.length})
        </button>
        <button
          className={`documents-nav-btn ${activeTab === 'mous' ? 'active' : ''}`}
          onClick={() => setActiveTab('mous')}
        >
          MoU Agreements ({mous.length})
        </button>
        <button
          className={`documents-nav-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Event Proposals ({eventProposals.length})
        </button>
        <button
          className={`documents-nav-btn ${activeTab === 'sponsorships' ? 'active' : ''}`}
          onClick={() => setActiveTab('sponsorships')}
        >
          Sponsorships ({sponsorships.length})
        </button>
        <button
          className={`documents-nav-btn ${activeTab === 'partners' ? 'active' : ''}`}
          onClick={() => setActiveTab('partners')}
        >
          Community Partners ({partners.length})
        </button>
      </div>

      {/* Tab 1: Resource Materials */}
      {activeTab === 'resources' && (
        <div className="documents-tab-content">
          {loading ? (
            <div>
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} />
            </div>
          ) : resources.length === 0 ? (
            <EmptyState
              title="No Resource Materials Available"
              description="Official guides, cheatsheets, templates, and reference materials published by TechNeekX Officials will appear here."
            />
          ) : (
            <div className="resources-grid">
              {resources.map(res => (
                <Card key={res.id} className="resource-card">
                  <CardHeader>
                    <div className="resource-header-top">
                      <Badge variant="primary">{res.category}</Badge>
                      <span className="resource-downloads">{res.download_count} Downloads</span>
                    </div>
                    <CardTitle>{res.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="resource-desc">{res.description || 'Official community documentation resource.'}</p>
                    <div className="resource-meta">
                      <span>Tier {res.min_role_tier}+ Access</span>
                      <span>By {res.uploaded_by_name || 'Official'}</span>
                    </div>
                    <Button
                      variant="outline"
                      className="resource-download-btn"
                      onClick={() => handleResourceDownload(res)}
                    >
                      Open & Track Download ↗
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: MoU Agreements */}
      {activeTab === 'mous' && (
        <div className="documents-tab-content">
          {loading ? (
            <div>
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} />
            </div>
          ) : mous.length === 0 ? (
            <EmptyState
              title="No MoU Agreements Found"
              description="Memorandums of Understanding between TechNeekX and partner institutions, colleges, and corporate partners will be tracked here."
            />
          ) : (
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Signee / Designation</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mous.map(mou => (
                    <TableRow key={mou.id}>
                      <TableCell className="font-semibold">{mou.organization_name}</TableCell>
                      <TableCell>
                        {mou.signatory_second_party || '—'}
                      </TableCell>
                      <TableCell>
                        {mou.validity_start} to {mou.validity_end}
                      </TableCell>
                      <TableCell>{getStatusBadge(mou.status)}</TableCell>
                      <TableCell className="text-secondary text-sm">
                        {mou.review_notes || 'No review notes'}
                      </TableCell>
                      <TableCell>
                        <div className="table-actions">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDownloadMouPdf(mou)}
                          >
                            PDF Download
                          </Button>
                          {isOfficial && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedMou(mou)
                                setMouReviewForm({ status: mou.status, review_notes: mou.review_notes || '' })
                                setShowMouReviewModal(true)
                              }}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Event Proposals */}
      {activeTab === 'events' && (
        <div className="documents-tab-content">
          {loading ? (
            <div>
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} />
            </div>
          ) : eventProposals.length === 0 ? (
            <EmptyState
              title="No Event Proposals Submitted"
              description="Propose community workshops, webinars, hackathons, or bootcamps for official sponsorship and scheduling."
            />
          ) : (
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Title</TableHead>
                    <TableHead>Type & Target Date</TableHead>
                    <TableHead>Attendees / Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewer Feedback</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventProposals.map(event => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="font-semibold">{event.title}</div>
                        <div className="text-xs text-secondary">{event.venue_or_platform}</div>
                      </TableCell>
                      <TableCell>
                        <div><Badge variant="outline">{event.event_type}</Badge></div>
                        <div className="text-xs text-secondary mt-1">{event.target_date}</div>
                      </TableCell>
                      <TableCell>
                        <div>~{event.expected_attendees} attendees</div>
                        <div className="text-xs text-secondary">Budget: ${event.estimated_budget}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(event.status)}</TableCell>
                      <TableCell className="text-sm text-secondary">
                        {event.reviewer_feedback ? (
                          <span>{event.reviewer_feedback}</span>
                        ) : (
                          <span className="italic">Awaiting official review</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="table-actions">
                          {isOfficial && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(event)
                                setEventReviewForm({
                                  decision: (event.status === 'Approved' || event.status === 'Rejected' ? event.status : 'Approved') as any,
                                  feedback: event.reviewer_feedback || ''
                                })
                                setShowEventReviewModal(true)
                              }}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Sponsorship Proposals */}
      {activeTab === 'sponsorships' && (
        <div className="documents-tab-content">
          {loading ? (
            <div>
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} />
            </div>
          ) : sponsorships.length === 0 ? (
            <EmptyState
              title="No Sponsorship Pitches Recorded"
              description="Track company outreach, sponsorship packages, offered community perks, and deal closures."
            />
          ) : (
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sponsor Organization</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deliverables</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsorships.map(sp => (
                    <TableRow key={sp.id}>
                      <TableCell className="font-semibold">{sp.sponsor_organization}</TableCell>
                      <TableCell>
                        <div>{sp.contact_person || '—'}</div>
                        <div className="text-xs text-secondary">{sp.contact_email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="primary">{sp.sponsorship_tier}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">${Number(sp.amount_requested).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(sp.status)}</TableCell>
                      <TableCell className="text-xs text-secondary max-w-xs truncate">
                        {sp.deliverables_offered || 'Standard partner package'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Community Partners */}
      {activeTab === 'partners' && (
        <div className="documents-tab-content">
          {loading ? (
            <div>
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} />
            </div>
          ) : partners.length === 0 ? (
            <EmptyState
              title="No Registered Community Partners"
              description="College tech clubs, external developer communities, and student chapters affiliated with TechNeekX appear here."
            />
          ) : (
            <div className="partners-grid">
              {partners.map(partner => (
                <Card key={partner.id} className="partner-card">
                  <CardHeader>
                    <div className="partner-header-top">
                      <Badge variant="outline">{partner.partner_type}</Badge>
                      {getStatusBadge(partner.status)}
                    </div>
                    <CardTitle>{partner.organization_name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="partner-goals">
                      {partner.benefits_summary || 'Strategic cross-community collaboration and event co-hosting.'}
                    </p>
                    <div className="partner-meta">
                      <div>POC: {partner.poc_name}</div>
                      {partner.poc_email && <span>Email: {partner.poc_email}</span>}
                    </div>
                    {partner.website && (
                      <a
                        href={partner.website}
                        target="_blank"
                        rel="noreferrer"
                        className="partner-link"
                      >
                        Visit Website ↗
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Publish Resource Material */}
      <Modal
        isOpen={showResourceModal}
        onClose={() => setShowResourceModal(false)}
        title="Publish Official Resource Material"
      >
        <form onSubmit={handleCreateResource} className="doc-modal-form">
          <Input
            label="Resource Title *"
            value={resourceForm.title}
            onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })}
            placeholder="e.g. TechNeekX Web3 Bootcamp Cheatsheet"
            required
          />
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={resourceForm.category}
              onChange={e => setResourceForm({ ...resourceForm, category: e.target.value as any })}
            >
              <option value="Guide">Guide</option>
              <option value="Template">Template</option>
              <option value="Cheatsheet">Cheatsheet</option>
              <option value="Brand Asset">Brand Asset</option>
              <option value="Tool">Tool</option>
            </select>
          </div>
          <Input
            label="Resource Document URL *"
            value={resourceForm.file_url}
            onChange={e => setResourceForm({ ...resourceForm, file_url: e.target.value })}
            placeholder="https://drive.google.com/... or https://techneekx.org/docs/..."
            required
          />
          <div className="form-group">
            <label className="form-label">Minimum Role Tier Access</label>
            <select
              className="form-select"
              value={resourceForm.min_role_tier}
              onChange={e => setResourceForm({ ...resourceForm, min_role_tier: parseInt(e.target.value, 10) })}
            >
              <option value={5}>Tier 5 (All Community Members)</option>
              <option value={3}>Tier 3 (Core Team Leads Only)</option>
              <option value={2}>Tier 2 (Officials Only)</option>
            </select>
          </div>
          <Textarea
            label="Description"
            value={resourceForm.description}
            onChange={e => setResourceForm({ ...resourceForm, description: e.target.value })}
            placeholder="Overview of the material and recommended prerequisites..."
            rows={3}
          />
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowResourceModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Publish Resource
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create MoU Proposal */}
      <Modal
        isOpen={showMouModal}
        onClose={() => setShowMouModal(false)}
        title="Initialize New MoU Agreement"
      >
        <form onSubmit={handleCreateMou} className="doc-modal-form">
          <Input
            label="Partner Organization Name *"
            value={mouForm.organization_name}
            onChange={e => setMouForm({ ...mouForm, organization_name: e.target.value })}
            placeholder="e.g. Apex Institute of Technology"
            required
          />
          <Input
            label="Second Party Signatory & Designation *"
            value={mouForm.signatory_second_party}
            onChange={e => setMouForm({ ...mouForm, signatory_second_party: e.target.value })}
            placeholder="Dr. S. Sharma, Head of CSE Dept"
            required
          />
          <div className="form-row">
            <Input
              label="Effective Start Date *"
              type="date"
              value={mouForm.validity_start}
              onChange={e => setMouForm({ ...mouForm, validity_start: e.target.value })}
              required
            />
            <Input
              label="End Date *"
              type="date"
              value={mouForm.validity_end}
              onChange={e => setMouForm({ ...mouForm, validity_end: e.target.value })}
              required
            />
          </div>
          <Textarea
            label="Scope of Work & Deliverables *"
            value={mouForm.scope_of_work}
            onChange={e => setMouForm({ ...mouForm, scope_of_work: e.target.value })}
            placeholder="Joint hackathons, technical workshop series, mentorship, and career placement support..."
            rows={4}
            required
          />
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowMouModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create MoU Proposal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Review MoU */}
      <Modal
        isOpen={showMouReviewModal}
        onClose={() => setShowMouReviewModal(false)}
        title={`Review MoU: ${selectedMou?.organization_name}`}
      >
        <form onSubmit={handleReviewMou} className="doc-modal-form">
          <div className="form-group">
            <label className="form-label">Agreement Status</label>
            <select
              className="form-select"
              value={mouReviewForm.status}
              onChange={e => setMouReviewForm({ ...mouReviewForm, status: e.target.value })}
            >
              <option value="Draft">Draft</option>
              <option value="In Review">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Signed">Signed</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>
          <Textarea
            label="Review Notes & Official Remarks"
            value={mouReviewForm.review_notes}
            onChange={e => setMouReviewForm({ ...mouReviewForm, review_notes: e.target.value })}
            placeholder="Add legal verification notes, signatory remarks, or revision requirements..."
            rows={3}
          />
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowMouReviewModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Status
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Submit Event Proposal */}
      <Modal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title="Submit Community Event Proposal"
      >
        <form onSubmit={handleCreateEvent} className="doc-modal-form">
          <Input
            label="Event Title *"
            value={eventForm.title}
            onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
            placeholder="e.g. Next.js 15 Full-Stack Accelerator"
            required
          />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select
                className="form-select"
                value={eventForm.event_type}
                onChange={e => setEventForm({ ...eventForm, event_type: e.target.value })}
              >
                <option value="Workshop">Workshop</option>
                <option value="Webinar">Webinar</option>
                <option value="Hackathon">Hackathon</option>
                <option value="Bootcamp">Bootcamp</option>
                <option value="Meetup">Meetup</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <Input
              label="Target Date *"
              type="date"
              value={eventForm.target_date}
              onChange={e => setEventForm({ ...eventForm, target_date: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <Input
              label="Expected Attendees"
              type="number"
              value={eventForm.expected_attendees}
              onChange={e => setEventForm({ ...eventForm, expected_attendees: parseInt(e.target.value, 10) || 0 })}
            />
            <Input
              label="Estimated Budget ($)"
              type="number"
              value={eventForm.estimated_budget}
              onChange={e => setEventForm({ ...eventForm, estimated_budget: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <Input
            label="Platform / Venue *"
            value={eventForm.venue_or_platform}
            onChange={e => setEventForm({ ...eventForm, venue_or_platform: e.target.value })}
            required
          />
          <Textarea
            label="Description & Agenda *"
            value={eventForm.description}
            onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
            placeholder="Session outcomes, speaker profile, target audience..."
            rows={3}
            required
          />
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowEventModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Submit Proposal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Review Event Proposal */}
      <Modal
        isOpen={showEventReviewModal}
        onClose={() => setShowEventReviewModal(false)}
        title={`Review Proposal: ${selectedEvent?.title}`}
      >
        <form onSubmit={handleReviewEvent} className="doc-modal-form">
          <div className="form-group">
            <label className="form-label">Review Decision</label>
            <select
              className="form-select"
              value={eventReviewForm.decision}
              onChange={e => setEventReviewForm({ ...eventReviewForm, decision: e.target.value as any })}
            >
              <option value="Approved">Approved (Budget & Schedule Confirmed)</option>
              <option value="Under Review">Under Review (Need Additional Details)</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <Textarea
            label="Reviewer Feedback"
            value={eventReviewForm.feedback}
            onChange={e => setEventReviewForm({ ...eventReviewForm, feedback: e.target.value })}
            placeholder="Provide specific feedback or budget adjustments..."
            rows={3}
          />
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowEventReviewModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Submit Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Sponsorship Pitch */}
      <Modal
        isOpen={showSponsorModal}
        onClose={() => setShowSponsorModal(false)}
        title="Add Sponsorship Pitch"
      >
        <form onSubmit={handleCreateSponsor} className="doc-modal-form">
          <Input
            label="Sponsor Company *"
            value={sponsorForm.sponsor_organization}
            onChange={e => setSponsorForm({ ...sponsorForm, sponsor_organization: e.target.value })}
            placeholder="e.g. CloudScale Inc"
            required
          />
          <div className="form-row">
            <Input
              label="Contact Person *"
              value={sponsorForm.contact_person}
              onChange={e => setSponsorForm({ ...sponsorForm, contact_person: e.target.value })}
              required
            />
            <Input
              label="Contact Email *"
              type="email"
              value={sponsorForm.contact_email}
              onChange={e => setSponsorForm({ ...sponsorForm, contact_email: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tier</label>
              <select
                className="form-select"
                value={sponsorForm.sponsorship_tier}
                onChange={e => setSponsorForm({ ...sponsorForm, sponsorship_tier: e.target.value as any })}
              >
                <option value="Title">Title ($5,000+)</option>
                <option value="Platinum">Platinum ($2,500)</option>
                <option value="Gold">Gold ($1,000)</option>
                <option value="Silver">Silver ($500)</option>
                <option value="Community">Community ($250)</option>
              </select>
            </div>
            <Input
              label="Proposed Amount ($) *"
              type="number"
              value={sponsorForm.amount_requested}
              onChange={e => setSponsorForm({ ...sponsorForm, amount_requested: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <Textarea
            label="Deliverables Offered *"
            value={sponsorForm.deliverables_offered}
            onChange={e => setSponsorForm({ ...sponsorForm, deliverables_offered: e.target.value })}
            placeholder="Logo on event stage, hiring booth, keynote address..."
            rows={2}
            required
          />
          <Textarea
            label="Internal Notes"
            value={sponsorForm.notes}
            onChange={e => setSponsorForm({ ...sponsorForm, notes: e.target.value })}
            placeholder="Negotiation progress, meeting dates..."
            rows={2}
          />
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowSponsorModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Pitch
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Register Partner */}
      <Modal
        isOpen={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
        title="Register Community Partner"
      >
        <form onSubmit={handleCreatePartner} className="doc-modal-form">
          <Input
            label="Organization Name *"
            value={partnerForm.organization_name}
            onChange={e => setPartnerForm({ ...partnerForm, organization_name: e.target.value })}
            placeholder="e.g. Developer Student Clubs"
            required
          />
          <div className="form-group">
            <label className="form-label">Partner Type</label>
            <select
              className="form-select"
              value={partnerForm.partner_type}
              onChange={e => setPartnerForm({ ...partnerForm, partner_type: e.target.value as any })}
            >
              <option value="College Club">College Club</option>
              <option value="Tech Community">Tech Community</option>
              <option value="Corporate">Corporate</option>
              <option value="Media Partner">Media Partner</option>
              <option value="Incubator">Incubator</option>
            </select>
          </div>
          <div className="form-row">
            <Input
              label="Point of Contact Name *"
              value={partnerForm.poc_name}
              onChange={e => setPartnerForm({ ...partnerForm, poc_name: e.target.value })}
              placeholder="Full Name"
              required
            />
            <Input
              label="Point of Contact Email *"
              type="email"
              value={partnerForm.poc_email}
              onChange={e => setPartnerForm({ ...partnerForm, poc_email: e.target.value })}
              required
            />
          </div>
          <Input
            label="Website URL"
            value={partnerForm.website}
            onChange={e => setPartnerForm({ ...partnerForm, website: e.target.value })}
            placeholder="https://..."
          />
          <Textarea
            label="Benefits & Mutual Goals *"
            value={partnerForm.benefits_summary}
            onChange={e => setPartnerForm({ ...partnerForm, benefits_summary: e.target.value })}
            placeholder="Mutual workshop sharing, hackathon co-sponsorship, mentorship..."
            rows={3}
            required
          />
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setShowPartnerModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Register Partner
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
