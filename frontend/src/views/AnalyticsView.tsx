import React, { useState, useEffect } from 'react'
import {
  Download,
  FileText,
  Calendar,
  Filter,
  Users,
  Layers
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Alert } from '../components/ui/Alert'
import { Skeleton } from '../components/ui/Skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { useAuth } from '../context/AuthContext'
import { analyticsApi, teamsApi } from '../services/api'
import type { AnalyticsOverview, TeamSummary } from '../types/api'
import './AnalyticsView.css'

export const AnalyticsView: React.FC = () => {
  const { roleTier } = useAuth()
  const isLead = roleTier <= 3

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [days, setDays] = useState<number>(30)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const loadTeams = React.useCallback(async () => {
    try {
      const res = await teamsApi.getTeams()
      setTeams(Array.isArray(res) ? res : res.results || [])
    } catch {
      // Fallback
    }
  }, [])

  const loadAnalytics = React.useCallback(async () => {
    setLoading(true)
    setStatusMessage(null)
    try {
      const data = await analyticsApi.getOverview({
        days,
        team_id: selectedTeamId ? Number(selectedTeamId) : undefined
      })
      setOverview(data)
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to load advanced analytics overview.' })
    } finally {
      setLoading(false)
    }
  }, [days, selectedTeamId])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // Trigger file download helper
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleDownloadPdf = async () => {
    setDownloading('pdf')
    try {
      const blob = await analyticsApi.downloadPdfReport({
        days,
        team_id: selectedTeamId ? Number(selectedTeamId) : undefined
      })
      triggerDownload(blob, `techneekx_executive_report_${days}d.pdf`)
      setStatusMessage({ type: 'success', text: 'Executive PDF report downloaded successfully.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to download PDF report.' })
    } finally {
      setDownloading(null)
    }
  }

  const handleExportTasksCsv = async () => {
    setDownloading('tasks-csv')
    try {
      const blob = await analyticsApi.downloadTasksCsv({
        team_id: selectedTeamId ? Number(selectedTeamId) : undefined
      })
      triggerDownload(blob, 'techneekx_tasks_metrics.csv')
      setStatusMessage({ type: 'success', text: 'Tasks CSV exported successfully.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to export tasks CSV.' })
    } finally {
      setDownloading(null)
    }
  }

  const handleExportTeamsCsv = async () => {
    setDownloading('teams-csv')
    try {
      const blob = await analyticsApi.downloadTeamsCsv()
      triggerDownload(blob, 'techneekx_teams_performance.csv')
      setStatusMessage({ type: 'success', text: 'Teams performance CSV exported.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to export teams CSV.' })
    } finally {
      setDownloading(null)
    }
  }

  const handleExportMembersCsv = async () => {
    setDownloading('members-csv')
    try {
      const blob = await analyticsApi.downloadMembersCsv()
      triggerDownload(blob, 'techneekx_member_contributions.csv')
      setStatusMessage({ type: 'success', text: 'Member contributions CSV exported.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to export members CSV.' })
    } finally {
      setDownloading(null)
    }
  }

  if (loading && !overview) {
    return (
      <div className="analytics-view">
        <Skeleton height={60} style={{ marginBottom: 16 }} />
        <div className="analytics-kpi-grid">
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
        </div>
        <Skeleton height={280} style={{ marginTop: 16 }} />
      </div>
    )
  }

  const summary = overview?.summary
  const trends = overview?.trends || []
  const maxTrend = Math.max(1, ...trends.map(t => Math.max(t.created, t.completed)))
  const pending = overview?.pending_analysis
  const hackathons = overview?.hackathon_analytics

  return (
    <div className="analytics-view">
      {/* Header & Controls */}
      <div className="analytics-header">
        <div className="analytics-title-group">
          <h2>Operations & Performance Intelligence</h2>
          <p>
            Real-time data-backed analytics, completion trends, bottleneck diagnostics, and multi-format reports.
          </p>
        </div>

        {/* Global Controls & Filters */}
        <div className="analytics-controls-bar">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-secondary" />
            <select
              className="analytics-filter-select"
              value={days}
              onChange={e => setDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-secondary" />
            <select
              className="analytics-filter-select"
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
            >
              <option value="">All Teams (Global Scope)</option>
              {teams.map(t => (
                <option key={t.team_id} value={t.team_id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export Action Buttons */}
          <div className="analytics-export-group">
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloading === 'pdf'}
            >
              <FileText size={15} style={{ marginRight: 6 }} />
              {downloading === 'pdf' ? 'Generating PDF...' : 'Executive PDF'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTasksCsv}
              disabled={downloading === 'tasks-csv'}
            >
              <Download size={15} style={{ marginRight: 6 }} />
              Tasks CSV
            </Button>

            {isLead && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTeamsCsv}
                disabled={downloading === 'teams-csv'}
              >
                <Layers size={15} style={{ marginRight: 6 }} />
                Teams CSV
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMembersCsv}
              disabled={downloading === 'members-csv'}
            >
              <Users size={15} style={{ marginRight: 6 }} />
              Members CSV
            </Button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <Alert variant={statusMessage.type} onClose={() => setStatusMessage(null)}>
          {statusMessage.text}
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="analytics-kpi-grid">
        <Card className="analytics-kpi-card">
          <CardContent>
            <div className="kpi-title">Total Workload Tracked</div>
            <div className="kpi-value-row">
              <span className="kpi-main-number">{summary?.total_tasks || 0}</span>
              <span className="kpi-trend-pill trend-good">Active Lifecycle</span>
            </div>
          </CardContent>
        </Card>

        <Card className="analytics-kpi-card">
          <CardContent>
            <div className="kpi-title">Task Completion Rate</div>
            <div className="kpi-value-row">
              <span className="kpi-main-number">{summary?.completion_rate_percent || 0}%</span>
              <span className="kpi-trend-pill trend-good">
                {summary?.approved_tasks || 0} Approved
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="analytics-kpi-card">
          <CardContent>
            <div className="kpi-title">Overdue Backlog</div>
            <div className="kpi-value-row">
              <span className="kpi-main-number">{summary?.overdue_tasks_count || 0}</span>
              <span className={`kpi-trend-pill ${(summary?.overdue_tasks_count || 0) > 0 ? 'trend-danger' : 'trend-good'}`}>
                {(summary?.overdue_tasks_count || 0) > 0 ? 'Needs Attention' : 'On Schedule'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="analytics-kpi-card">
          <CardContent>
            <div className="kpi-title">Pending Reviews Waiting</div>
            <div className="kpi-value-row">
              <span className="kpi-main-number">{summary?.pending_reviews_count || 0}</span>
              <span className={`kpi-trend-pill ${(summary?.pending_reviews_count || 0) > 3 ? 'trend-warning' : 'trend-good'}`}>
                {summary?.pending_reviews_count || 0} In Queue
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Chart & Review Bottleneck Section */}
      <div className="analytics-charts-grid">
        {/* Task Completion Trend Bar Chart */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Workload Activity & Completion Trend</CardTitle>
              <div className="chart-legend">
                <div className="legend-item">
                  <div className="legend-dot" style={{ background: 'var(--color-primary)' }} />
                  <span>Tasks Created</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{ background: 'var(--color-success)' }} />
                  <span>Approved</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trends.length === 0 ? (
              <p className="text-secondary text-sm">No activity recorded for this period.</p>
            ) : (
              <div className="chart-container">
                {trends.slice(-14).map((point, idx) => {
                  const hCreated = Math.max(4, (point.created / maxTrend) * 160)
                  const hCompleted = Math.max(4, (point.completed / maxTrend) * 160)
                  return (
                    <div key={idx} className="chart-bar-group">
                      <div className="chart-bar-bars">
                        <div
                          className="bar-created"
                          style={{ height: `${hCreated}px` }}
                          title={`Created: ${point.created}`}
                        />
                        <div
                          className="bar-completed"
                          style={{ height: `${hCompleted}px` }}
                          title={`Approved: ${point.completed}`}
                        />
                      </div>
                      <span className="chart-label">{point.date}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Aging & Bottlenecks */}
        <Card>
          <CardHeader>
            <CardTitle>Review Aging & Bottlenecks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aging-distribution">
              <div className="aging-row">
                <div className="aging-label">
                  <div className="aging-dot" style={{ background: 'var(--color-success)' }} />
                  <span>&lt; 24h (Fresh)</span>
                </div>
                <Badge variant="success">{pending?.under_24h || 0}</Badge>
              </div>

              <div className="aging-row">
                <div className="aging-label">
                  <div className="aging-dot" style={{ background: 'var(--color-warning)' }} />
                  <span>24h – 48h (Delayed)</span>
                </div>
                <Badge variant="warning">{pending?.from_24_to_48h || 0}</Badge>
              </div>

              <div className="aging-row">
                <div className="aging-label">
                  <div className="aging-dot" style={{ background: 'var(--color-danger-solid)' }} />
                  <span>&gt; 48h (Escalation Required)</span>
                </div>
                <Badge variant="danger">{pending?.over_48h || 0}</Badge>
              </div>
            </div>

            {pending && pending.urgent_items.length > 0 && (
              <div className="urgent-items-list">
                <div className="text-xs font-semibold text-secondary uppercase mb-2">
                  Urgent Items Waiting Review
                </div>
                {pending.urgent_items.slice(0, 4).map(item => (
                  <div key={item.task_id} className="urgent-item-row">
                    <div className="truncate pr-2">
                      <span className="font-medium text-primary">#{item.task_id} {item.title}</span>
                      <div className="text-xs text-secondary">{item.team_name} • {item.age_hours}h ago</div>
                    </div>
                    <Badge variant={item.priority === 'Urgent' ? 'danger' : 'warning'} size="sm">
                      {item.age_hours}h
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Performance & Member Contribution Tables */}
      <div className="analytics-tables-grid">
        {/* Team Performance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Team Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview?.team_performance || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-secondary">
                        No team activity found
                      </TableCell>
                    </TableRow>
                  ) : (
                    overview?.team_performance.map(t => (
                      <TableRow key={t.team_id}>
                        <TableCell className="font-semibold">{t.name}</TableCell>
                        <TableCell>{t.members_count}</TableCell>
                        <TableCell>{t.total_tasks}</TableCell>
                        <TableCell>{t.approved_tasks}</TableCell>
                        <TableCell>
                          {t.overdue_tasks > 0 ? (
                            <span className="text-danger font-semibold">{t.overdue_tasks}</span>
                          ) : (
                            <span className="text-secondary">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.completion_rate_percent >= 50 ? 'success' : 'outline'}>
                            {t.completion_rate_percent}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Member Contributions */}
        <Card>
          <CardHeader>
            <CardTitle>Top Contributors & Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Approval %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview?.member_contributions || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-secondary">
                        No member contributions recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    overview?.member_contributions.slice(0, 8).map(m => (
                      <TableRow key={m.user_id}>
                        <TableCell>
                          <div className="font-semibold">{m.name}</div>
                          <div className="text-xs text-secondary">{m.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-primary">{m.total_points} pts</TableCell>
                        <TableCell>{m.tasks_approved} / {m.tasks_assigned}</TableCell>
                        <TableCell>
                          <Badge variant={m.approval_rate_percent >= 80 ? 'success' : 'primary'}>
                            {m.approval_rate_percent}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hackathons & Recruitment Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle>Hackathon Competitions & Candidate Recruitment Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hackathon-stats-grid">
            <div className="hackathon-stat-box">
              <div className="hackathon-stat-val">{hackathons?.total_hackathons || 0}</div>
              <div className="hackathon-stat-lbl">National Competitions</div>
            </div>
            <div className="hackathon-stat-box">
              <div className="hackathon-stat-val">{hackathons?.total_participants || 0}</div>
              <div className="hackathon-stat-lbl">Registered Participants</div>
            </div>
            <div className="hackathon-stat-box">
              <div className="hackathon-stat-val text-success">
                {hackathons?.certificates.verified || 0} / {hackathons?.certificates.submitted || 0}
              </div>
              <div className="hackathon-stat-lbl">Certificates Verified</div>
            </div>
            <div className="hackathon-stat-box">
              <div className="hackathon-stat-val text-primary">
                {hackathons?.recruitment.accepted || 0} / {hackathons?.recruitment.total_shortlisted || 0}
              </div>
              <div className="hackathon-stat-lbl">Recruits Accepted</div>
            </div>
            <div className="hackathon-stat-box">
              <div className="hackathon-stat-val">
                {hackathons?.recruitment.conversion_rate_percent || 0}%
              </div>
              <div className="hackathon-stat-lbl">Recruitment Conversion Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
