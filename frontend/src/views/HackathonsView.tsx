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
import { hackathonApi } from '../services/api'
import type {
  Hackathon,
  HackathonTeam,
  CertificateSubmission,
  HackathonRanking,
  CandidateShortlist,
  RecruitmentAnalytics
} from '../types/api'
import './HackathonsView.css'

export const HackathonsView: React.FC = () => {
  const { user, roleTier } = useAuth()
  const isOfficial = roleTier <= 2
  const isReviewer = roleTier <= 3

  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [selectedHackathon, setSelectedHackathon] = useState<Hackathon | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'directory' | 'teams' | 'certificates' | 'leaderboard' | 'recruitment'>('directory')
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  // Submissions and verification
  const [certificates, setCertificates] = useState<CertificateSubmission[]>([])
  const [certLoading, setCertLoading] = useState(false)

  // Leaderboard data
  const [rankings, setRankings] = useState<HackathonRanking[]>([])
  const [teamRankings, setTeamRankings] = useState<HackathonTeam[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  // Recruitment shortlist data
  const [shortlist, setShortlist] = useState<CandidateShortlist[]>([])
  const [analytics, setAnalytics] = useState<RecruitmentAnalytics | null>(null)
  const [shortlistLimit, setShortlistLimit] = useState(10)
  const [recruitmentLoading, setRecruitmentLoading] = useState(false)

  // Modals state
  const [showRegModal, setShowRegModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showCertModal, setShowCertModal] = useState(false)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateShortlist | null>(null)

  // Forms
  const [regForm, setRegForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    college_or_org: ''
  })

  const [teamForm, setTeamForm] = useState({
    team_name: '',
    project_title: '',
    project_repo: '',
    project_demo: '',
    submission_notes: ''
  })

  const [certForm, setCertForm] = useState({
    category: '1st',
    certificate_url: '',
    team_id: ''
  })

  const [decisionForm, setDecisionForm] = useState({
    decision: 'Accepted',
    offered_role: 'Core Operations Engineer',
    decision_reason: ''
  })

  const [reviewModalSub, setReviewModalSub] = useState<CertificateSubmission | null>(null)
  const [reviewForm, setReviewForm] = useState({
    decision: 'Approved' as 'Approved' | 'Rejected',
    feedback: '',
    override_points: 0
  })

  const loadHackathons = async () => {
    try {
      setLoading(true)
      const data = await hackathonApi.getHackathons()
      const list = Array.isArray(data) ? data : (data.results || [])
      setHackathons(list)
      if (list.length > 0 && !selectedHackathon) {
        setSelectedHackathon(list[0])
      }
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to load hackathons' })
    } finally {
      setLoading(false)
    }
  }

  const loadCertificates = async () => {
    try {
      setCertLoading(true)
      const data = await hackathonApi.getCertificates()
      const list = Array.isArray(data) ? data : (data.results || [])
      setCertificates(list)
    } catch (err: any) {
      console.error(err)
    } finally {
      setCertLoading(false)
    }
  }

  const loadLeaderboard = async (hackathonId: number) => {
    try {
      setLeaderboardLoading(true)
      const res = await hackathonApi.getLeaderboard(hackathonId)
      setRankings(res.individual_rankings || [])
      setTeamRankings(res.team_rankings || [])
    } catch (err: any) {
      console.error(err)
    } finally {
      setLeaderboardLoading(false)
    }
  }

  const loadRecruitment = async (hackathonId: number, limit = shortlistLimit) => {
    if (!isOfficial) return
    try {
      setRecruitmentLoading(true)
      const [shortlistRes, analyticsRes] = await Promise.all([
        hackathonApi.getShortlist(hackathonId, limit),
        hackathonApi.getRecruitmentAnalytics(hackathonId)
      ])
      setShortlist(shortlistRes.candidates || [])
      setAnalytics(analyticsRes)
    } catch (err: any) {
      console.error(err)
    } finally {
      setRecruitmentLoading(false)
    }
  }

  useEffect(() => {
    loadHackathons()
    loadCertificates()
  }, [])

  useEffect(() => {
    if (selectedHackathon) {
      if (activeTab === 'leaderboard') {
        loadLeaderboard(selectedHackathon.id)
      } else if (activeTab === 'recruitment') {
        loadRecruitment(selectedHackathon.id)
      }
    }
  }, [selectedHackathon, activeTab])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHackathon) return
    try {
      await hackathonApi.register(selectedHackathon.id, regForm)
      setShowRegModal(false)
      setRegForm({ full_name: '', email: '', phone: '', college_or_org: '' })
      loadHackathons()
      setStatusMessage({ type: 'success', text: 'Registered for hackathon successfully!' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Registration failed' })
    }
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHackathon) return
    try {
      await hackathonApi.createTeam(selectedHackathon.id, teamForm)
      setShowTeamModal(false)
      setTeamForm({ team_name: '', project_title: '', project_repo: '', project_demo: '', submission_notes: '' })
      loadHackathons()
      setStatusMessage({ type: 'success', text: `Team '${teamForm.team_name}' registered successfully!` })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to create team' })
    }
  }

  const handleSubmitCertificate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHackathon) return
    try {
      await hackathonApi.submitCertificate({
        hackathon: selectedHackathon.id,
        category: certForm.category,
        certificate_url: certForm.certificate_url,
        team: certForm.team_id ? Number(certForm.team_id) : null
      })
      setShowCertModal(false)
      setCertForm({ category: '1st', certificate_url: '', team_id: '' })
      loadCertificates()
      setStatusMessage({ type: 'success', text: 'Certificate proof submitted for review!' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Certificate submission failed' })
    }
  }

  const handleReviewCertificate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewModalSub) return
    try {
      await hackathonApi.reviewCertificate(reviewModalSub.id, {
        decision: reviewForm.decision,
        feedback: reviewForm.feedback,
        override_points: reviewForm.override_points > 0 ? reviewForm.override_points : undefined
      })
      setReviewModalSub(null)
      loadCertificates()
      if (selectedHackathon) {
        loadLeaderboard(selectedHackathon.id)
      }
      setStatusMessage({ type: 'success', text: `Certificate marked as ${reviewForm.decision}.` })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Review action failed' })
    }
  }

  const handleUpdateDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCandidate || !selectedHackathon) return
    try {
      await hackathonApi.updateShortlistDecision(selectedHackathon.id, {
        candidate_id: selectedCandidate.id,
        decision: decisionForm.decision,
        offered_role: decisionForm.offered_role,
        decision_reason: decisionForm.decision_reason
      })
      setShowDecisionModal(false)
      loadRecruitment(selectedHackathon.id)
      setStatusMessage({ type: 'success', text: `Candidate decision updated to ${decisionForm.decision}.` })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to update recruitment decision' })
    }
  }

  if (loading) {
    return (
      <div className="hackathons-container">
        <Skeleton height="60px" style={{ marginBottom: '20px' }} />
        <Skeleton height="250px" style={{ marginBottom: '20px' }} />
        <Skeleton height="350px" />
      </div>
    )
  }

  return (
    <div className="hackathons-container">
      {/* Header */}
      <div className="hackathon-header">
        <div>
          <h1 className="hackathon-title">Hackathons & Certificate Management</h1>
          <p className="hackathon-subtitle">
            Participate in national coding competitions, verify achievement certificates, track rankings, and access recruitment shortlists.
          </p>
        </div>
        <div className="hackathon-header-actions">
          {selectedHackathon && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setRegForm({
                    full_name: user?.name || '',
                    email: user?.email || '',
                    phone: '',
                    college_or_org: ''
                  })
                  setShowRegModal(true)
                }}
              >
                📝 Register for Hackathon
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowTeamModal(true)}
              >
                👥 Register Team
              </Button>
            </>
          )}
        </div>
      </div>

      {statusMessage && (
        <Alert
          variant={statusMessage.type}
          onClose={() => setStatusMessage(null)}
          style={{ marginBottom: '1.25rem' }}
        >
          {statusMessage.text}
        </Alert>
      )}

      {/* Tabs */}
      <div className="hackathon-tabs">
        <button
          className={`hackathon-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          🏆 Hackathon Events ({hackathons.length})
        </button>
        <button
          className={`hackathon-tab-btn ${activeTab === 'certificates' ? 'active' : ''}`}
          onClick={() => setActiveTab('certificates')}
        >
          📜 Certificate Verification ({certificates.length})
        </button>
        <button
          className={`hackathon-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          📊 Hackathon Leaderboard
        </button>
        {isOfficial && (
          <button
            className={`hackathon-tab-btn ${activeTab === 'recruitment' ? 'active' : ''}`}
            onClick={() => setActiveTab('recruitment')}
          >
            🎯 Recruitment & Selection ({shortlist.length})
          </button>
        )}
      </div>

      {/* TAB 1: Hackathon Events Directory */}
      {activeTab === 'directory' && (
        <div className="hackathon-grid">
          {hackathons.map((h) => {
            const isSelected = selectedHackathon?.id === h.id
            return (
              <Card
                key={h.id}
                className={`hackathon-card ${isSelected ? 'hackathon-card-selected' : ''}`}
                onClick={() => setSelectedHackathon(h)}
              >
                <CardHeader>
                  <div className="hackathon-card-header">
                    <div>
                      <Badge variant="info">{h.theme}</Badge>
                      <CardTitle style={{ marginTop: '0.4rem' }}>{h.title}</CardTitle>
                    </div>
                    <Badge variant={h.is_registration_open ? 'success' : 'default'}>
                      {h.is_registration_open ? 'Registration Open' : 'Registration Closed'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="hackathon-tagline">{h.tagline || h.description}</p>
                  <div className="hackathon-meta-row">
                    <div>
                      <strong>Dates:</strong> {new Date(h.start_date).toLocaleDateString()} - {new Date(h.end_date).toLocaleDateString()}
                    </div>
                    <div>
                      <strong>Team Size:</strong> {h.min_team_size} - {h.max_team_size} Members
                    </div>
                  </div>
                  <div className="hackathon-stats-pills">
                    <span className="stat-pill">👥 {h.participants_count || 0} Registered</span>
                    <span className="stat-pill">🚀 {h.teams_count || 0} Teams</span>
                    {h.allow_external_participants && (
                      <span className="stat-pill">🌐 External Open</span>
                    )}
                  </div>
                  {h.scoring_rules && (
                    <div className="scoring-rules-box">
                      <strong>Points Ledger:</strong> 1st: {h.scoring_rules['1st'] || 100} pts • 2nd: {h.scoring_rules['2nd'] || 75} pts • 3rd: {h.scoring_rules['3rd'] || 50} pts • Top 10: {h.scoring_rules['Top 10'] || 30} pts
                    </div>
                  )}
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant={isSelected ? 'primary' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedHackathon(h)
                      }}
                    >
                      {isSelected ? '✓ Selected Event' : 'Select Event'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedHackathon(h)
                        setShowCertModal(true)
                      }}
                    >
                      + Submit Certificate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* TAB 2: Certificate Management & Review Queue */}
      {activeTab === 'certificates' && (
        <div>
          <Card className="hackathon-card">
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <CardTitle>Certificate Verification Queue</CardTitle>
                <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                  {isReviewer
                    ? 'Official Reviewer Queue: Verify claims and award anti-duplicate placement points.'
                    : 'Your submitted hackathon achievements and review outcomes.'}
                </span>
              </div>
              <Button variant="primary" onClick={() => setShowCertModal(true)}>
                + Submit New Certificate
              </Button>
            </CardHeader>
            <CardContent>
              {certLoading ? (
                <Skeleton height="150px" />
              ) : certificates.length === 0 ? (
                <EmptyState
                  title="No Certificates Submitted"
                  description="Submit your participation, winner, or finalist certificate link for authorized verification."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hackathon</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Document Link</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Reviewer / Feedback</TableHead>
                      {isReviewer && <TableHead>Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell><strong>{cert.hackathon_title || `Hackathon #${cert.hackathon}`}</strong></TableCell>
                        <TableCell>
                          {cert.participant_name}
                          <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{cert.participant_email}</div>
                        </TableCell>
                        <TableCell><Badge variant="primary">{cert.category}</Badge></TableCell>
                        <TableCell>
                          <a
                            href={cert.certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#635BFF', fontWeight: 600, textDecoration: 'none' }}
                          >
                            View Document ↗
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cert.verification_status === 'Approved'
                                ? 'success'
                                : cert.verification_status === 'Rejected'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {cert.verification_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {cert.points_awarded > 0 ? (
                            <span style={{ color: '#059669', fontWeight: 700 }}>+{cert.points_awarded} pts</span>
                          ) : (
                            '0 pts'
                          )}
                        </TableCell>
                        <TableCell>
                          {cert.reviewer_name ? (
                            <div>
                              <div>Reviewed by <strong>{cert.reviewer_name}</strong></div>
                              {cert.reviewer_feedback && (
                                <div style={{ fontSize: '0.8rem', color: '#4B5563' }}>"{cert.reviewer_feedback}"</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#9CA3AF' }}>Pending review</span>
                          )}
                        </TableCell>
                        {isReviewer && (
                          <TableCell>
                            {cert.verification_status === 'Pending' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReviewModalSub(cert)
                                  setReviewForm({
                                    decision: 'Approved',
                                    feedback: '',
                                    override_points: 0
                                  })
                                }}
                              >
                                Review
                              </Button>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Decision final</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: Hackathon Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div>
          {selectedHackathon && (
            <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#111827' }}>Active Hackathon:</span>
              <select
                value={selectedHackathon.id}
                onChange={(e) => {
                  const found = hackathons.find((h) => h.id === Number(e.target.value))
                  if (found) setSelectedHackathon(found)
                }}
                className="hackathon-picker"
              >
                {hackathons.map((h) => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </select>
            </div>
          )}

          <Card className="hackathon-card">
            <CardHeader>
              <CardTitle>Individual Placement Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <Skeleton height="150px" />
              ) : rankings.length === 0 ? (
                <EmptyState
                  title="No Verified Rankings Yet"
                  description="Rankings are automatically compiled when placement certificates are approved by Officials."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Hackathon Points</TableHead>
                      <TableHead>Tie-Break Score</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant={r.rank_position <= 3 ? 'warning' : 'primary'}>
                            #{r.rank_position}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <strong>{r.participant_name}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{r.participant_email}</div>
                        </TableCell>
                        <TableCell>{r.team_name || 'Individual'}</TableCell>
                        <TableCell><strong style={{ color: '#635BFF' }}>{r.hackathon_points} pts</strong></TableCell>
                        <TableCell>{r.tie_break_score}</TableCell>
                        <TableCell><Badge variant="success">Verified</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Team Rankings Table */}
          <Card className="hackathon-card" style={{ marginTop: '1.5rem' }}>
            <CardHeader>
              <CardTitle>Team Hackathon Standings</CardTitle>
            </CardHeader>
            <CardContent>
              {teamRankings.length === 0 ? (
                <EmptyState
                  title="No Team Rankings Yet"
                  description="Register teams and compete in hackathons to track team standings."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Name</TableHead>
                      <TableHead>Leader</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Project Title</TableHead>
                      <TableHead>Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamRankings.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell><strong>{t.team_name}</strong></TableCell>
                        <TableCell>{t.leader_name}</TableCell>
                        <TableCell><Badge variant="info">{t.member_count || 1} members</Badge></TableCell>
                        <TableCell>{t.project_title || 'In Development'}</TableCell>
                        <TableCell>
                          {t.project_repo && (
                            <a href={t.project_repo} target="_blank" rel="noopener noreferrer" style={{ color: '#635BFF', marginRight: '0.75rem', fontWeight: 600 }}>
                              Repo ↗
                            </a>
                          )}
                          {t.project_demo && (
                            <a href={t.project_demo} target="_blank" rel="noopener noreferrer" style={{ color: '#635BFF', fontWeight: 600 }}>
                              Demo ↗
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: Recruitment Shortlist & Analytics (Tier 1/2) */}
      {activeTab === 'recruitment' && isOfficial && (
        <div>
          {analytics && (
            <div className="analytics-summary-bar">
              <div className="analytics-stat-card">
                <span className="stat-num">{analytics.total_participants}</span>
                <span className="stat-label">Total Participants</span>
              </div>
              <div className="analytics-stat-card">
                <span className="stat-num">{analytics.total_teams}</span>
                <span className="stat-label">Competing Teams</span>
              </div>
              <div className="analytics-stat-card">
                <span className="stat-num">{analytics.total_shortlisted}</span>
                <span className="stat-label">Shortlisted</span>
              </div>
              <div className="analytics-stat-card">
                <span className="stat-num" style={{ color: '#059669' }}>{analytics.total_accepted}</span>
                <span className="stat-label">Accepted Offers</span>
              </div>
              <div className="analytics-stat-card">
                <span className="stat-num" style={{ color: '#635BFF' }}>{analytics.conversion_rate_percent}%</span>
                <span className="stat-label">Offer Conversion Rate</span>
              </div>
            </div>
          )}

          <Card className="hackathon-card" style={{ marginTop: '1.5rem' }}>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <CardTitle>Official Recruitment Shortlist & Decisions</CardTitle>
                <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                  Review top contenders, record interview decisions, and extend Core Team / Intern offers.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Shortlist Filter:</span>
                <select
                  value={shortlistLimit}
                  onChange={(e) => {
                    const lim = Number(e.target.value)
                    setShortlistLimit(lim)
                    if (selectedHackathon) loadRecruitment(selectedHackathon.id, lim)
                  }}
                  className="shortlist-filter-select"
                >
                  <option value={5}>Top 5 Candidates</option>
                  <option value={10}>Top 10 Candidates</option>
                  <option value={20}>Top 20 Candidates</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {recruitmentLoading ? (
                <Skeleton height="150px" />
              ) : shortlist.length === 0 ? (
                <EmptyState
                  title="No Candidates Shortlisted"
                  description="Shortlists are generated automatically from top placements on the Hackathon Leaderboard."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Decision Status</TableHead>
                      <TableHead>Offered Role</TableHead>
                      <TableHead>Decision Rationale</TableHead>
                      <TableHead>Official Reviewer</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shortlist.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <strong>{c.participant_name}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{c.participant_email}</div>
                        </TableCell>
                        <TableCell>{c.team_name || 'Individual'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.decision === 'Accepted'
                                ? 'success'
                                : c.decision === 'Rejected'
                                ? 'danger'
                                : c.decision === 'On Hold'
                                ? 'warning'
                                : 'default'
                            }
                          >
                            {c.decision}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.offered_role ? (
                            <strong style={{ color: '#059669' }}>{c.offered_role}</strong>
                          ) : (
                            <span style={{ color: '#9CA3AF' }}>None</span>
                          )}
                        </TableCell>
                        <TableCell>{c.decision_reason || <span style={{ color: '#9CA3AF' }}>Pending interview</span>}</TableCell>
                        <TableCell>{c.reviewer_name || <span style={{ color: '#9CA3AF' }}>Unassigned</span>}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCandidate(c)
                              setDecisionForm({
                                decision: c.decision,
                                offered_role: c.offered_role || '',
                                decision_reason: c.decision_reason || ''
                              })
                              setShowDecisionModal(true)
                            }}
                          >
                            Update Decision
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Register Participant */}
      {showRegModal && selectedHackathon && (
        <Modal
          isOpen={showRegModal}
          onClose={() => setShowRegModal(false)}
          title={`Register for ${selectedHackathon.title}`}
        >
          <form onSubmit={handleRegister}>
            <Input
              label="Full Name *"
              required
              value={regForm.full_name}
              onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
            />
            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Email Address *"
                type="email"
                required
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Phone Number"
                placeholder="+91 9876543210"
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Input
                label="College / Organization"
                placeholder="e.g. DTU, IIT, TechNeekX"
                value={regForm.college_or_org}
                onChange={(e) => setRegForm({ ...regForm, college_or_org: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setShowRegModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Complete Registration
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Register Team */}
      {showTeamModal && selectedHackathon && (
        <Modal
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          title={`Register Team for ${selectedHackathon.title}`}
        >
          <form onSubmit={handleCreateTeam}>
            <Input
              label="Team Name *"
              required
              placeholder="e.g. Quantum Coders"
              value={teamForm.team_name}
              onChange={(e) => setTeamForm({ ...teamForm, team_name: e.target.value })}
            />
            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Project Title"
                placeholder="e.g. AI-Powered Distributed Cache"
                value={teamForm.project_title}
                onChange={(e) => setTeamForm({ ...teamForm, project_title: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <Input
                label="GitHub Repo Link"
                placeholder="https://github.com/..."
                value={teamForm.project_repo}
                onChange={(e) => setTeamForm({ ...teamForm, project_repo: e.target.value })}
              />
              <Input
                label="Live Demo URL"
                placeholder="https://..."
                value={teamForm.project_demo}
                onChange={(e) => setTeamForm({ ...teamForm, project_demo: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Textarea
                label="Submission Notes / Overview"
                rows={2}
                value={teamForm.submission_notes}
                onChange={(e) => setTeamForm({ ...teamForm, submission_notes: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setShowTeamModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Register Team
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Submit Certificate */}
      {showCertModal && selectedHackathon && (
        <Modal
          isOpen={showCertModal}
          onClose={() => setShowCertModal(false)}
          title={`Submit Certificate for ${selectedHackathon.title}`}
        >
          <form onSubmit={handleSubmitCertificate}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              Achievement Category *
            </label>
            <select
              value={certForm.category}
              onChange={(e) => setCertForm({ ...certForm, category: e.target.value })}
              className="cert-category-select"
            >
              <option value="1st">Winner (1st Place)</option>
              <option value="2nd">First Runner-Up (2nd Place)</option>
              <option value="3rd">Second Runner-Up (3rd Place)</option>
              <option value="Top 10">Top 10 Finalist</option>
              <option value="Special Mention">Special Mention / Category Award</option>
              <option value="Participation">Participation Certificate</option>
            </select>

            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Document / Verification URL *"
                required
                placeholder="https://drive.google.com/... or https://credential.net/..."
                value={certForm.certificate_url}
                onChange={(e) => setCertForm({ ...certForm, certificate_url: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setShowCertModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Submit for Verification
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Review Certificate (Officials Only) */}
      {reviewModalSub && (
        <Modal
          isOpen={!!reviewModalSub}
          onClose={() => setReviewModalSub(null)}
          title={`Verify Certificate: ${reviewModalSub.participant_name}`}
        >
          <form onSubmit={handleReviewCertificate}>
            <p style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '1rem' }}>
              Claimed Category: <strong>{reviewModalSub.category}</strong><br />
              Document Link: <a href={reviewModalSub.certificate_url} target="_blank" rel="noopener noreferrer" style={{ color: '#635BFF' }}>View Document ↗</a>
            </p>

            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              Verification Decision *
            </label>
            <select
              value={reviewForm.decision}
              onChange={(e) => setReviewForm({ ...reviewForm, decision: e.target.value as any })}
              className="cert-category-select"
            >
              <option value="Approved">Approve Certificate</option>
              <option value="Rejected">Reject Certificate</option>
            </select>

            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Override Points Awarded (Leave 0 to use rule default)"
                type="number"
                min="0"
                value={reviewForm.override_points}
                onChange={(e) => setReviewForm({ ...reviewForm, override_points: Number(e.target.value) })}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Textarea
                label="Reviewer Feedback / Verification Notes"
                rows={3}
                placeholder="State reason for decision..."
                value={reviewForm.feedback}
                onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setReviewModalSub(null)}>
                Cancel
              </Button>
              <Button
                variant={reviewForm.decision === 'Approved' ? 'primary' : 'danger'}
                type="submit"
              >
                Submit Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Recruitment Selection Decision */}
      {showDecisionModal && selectedCandidate && (
        <Modal
          isOpen={showDecisionModal}
          onClose={() => setShowDecisionModal(false)}
          title={`Recruitment Decision: ${selectedCandidate.participant_name}`}
        >
          <form onSubmit={handleUpdateDecision}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              Selection Decision *
            </label>
            <select
              value={decisionForm.decision}
              onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })}
              className="cert-category-select"
            >
              <option value="Accepted">Accepted / Offer Extended</option>
              <option value="Rejected">Rejected</option>
              <option value="On Hold">On Hold</option>
              <option value="Under Review">Under Review</option>
            </select>

            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Offered Role / Position (if accepted)"
                placeholder="e.g. Core Operations Lead, Backend Fellow"
                value={decisionForm.offered_role}
                onChange={(e) => setDecisionForm({ ...decisionForm, offered_role: e.target.value })}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Textarea
                label="Official Decision Rationale & Feedback *"
                required
                rows={3}
                placeholder="Explain the technical evaluation and interview reasoning..."
                value={decisionForm.decision_reason}
                onChange={(e) => setDecisionForm({ ...decisionForm, decision_reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setShowDecisionModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Record Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
