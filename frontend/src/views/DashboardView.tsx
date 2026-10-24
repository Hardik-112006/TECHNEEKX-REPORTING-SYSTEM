import React, { useState, useEffect } from 'react'
import {
  ListTodo,
  CheckCircle,
  Clock,
  Award,
  AlertTriangle,
  ArrowRight,
  Megaphone,
  History,
  RefreshCw
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
  Alert
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { tasksApi, scoringApi, announcementsApi, activityApi } from '../services/api'
import type { Task, Performance, Announcement, HistoryLog } from '../types/api'
import './DashboardView.css'

interface DashboardViewProps {
  onNavigateToTasks: () => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToTasks }) => {
  const { user, roleTier, roleName } = useAuth()

  // Real backend data states
  const [tasks, setTasks] = useState<Task[]>([])
  const [leaderboard, setLeaderboard] = useState<Performance[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [recentActivity, setRecentActivity] = useState<HistoryLog[]>([])

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [tasksRes, leadRes, annRes, actRes] = await Promise.allSettled([
        tasksApi.getTasks({ page: 1 }),
        scoringApi.getLeaderboard(1),
        announcementsApi.getAnnouncements(1),
        activityApi.getActivityLogs({ page: 1 })
      ])

      if (tasksRes.status === 'fulfilled') {
        setTasks(tasksRes.value.results || [])
      } else {
        console.error('Failed to load tasks', tasksRes.reason)
      }

      if (leadRes.status === 'fulfilled') {
        setLeaderboard(leadRes.value.results || [])
      }

      if (annRes.status === 'fulfilled') {
        setAnnouncements(annRes.value.results || [])
      }

      if (actRes.status === 'fulfilled') {
        setRecentActivity(actRes.value.results || [])
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard metrics.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  // Compute live metrics from real tasks
  const totalTasks = tasks.length
  const assignedCount = tasks.filter((t) => t.status === 'Assigned').length
  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length
  const submittedCount = tasks.filter((t) => t.status === 'Submitted').length
  const approvedCount = tasks.filter((t) => t.status === 'Approved').length

  // Find current user's performance record if present
  const myPerformance = leaderboard.find((p) => p.user?.user_id === user?.user_id)
  const myPoints = myPerformance ? myPerformance.points : 0
  const myRank = myPerformance ? myPerformance.rank : '-'

  const recentTasks = tasks.slice(0, 5)

  return (
    <div className="dashboard-container">
      {/* Welcome Banner */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Welcome back, {user?.name || 'Community Member'}</h1>
          <p className="dashboard-subtitle">
            Role: <strong>{roleName}</strong> (Tier {roleTier})
            {user?.team_name ? ` • Team: ${user.team_name}` : ''}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToTasks}
            rightIcon={<ArrowRight size={14} />}
          >
            Go to Tasks
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          variant="danger"
          title="Data Synchronization Notice"
          description={error}
        />
      )}

      {/* Real Metric Cards Grid */}
      <div className="metrics-grid">
        <Card className="metric-card">
          <CardContent className="metric-card-content">
            <div className="metric-icon-box assigned">
              <ListTodo size={22} />
            </div>
            <div className="metric-details">
              <span className="metric-label">Assigned</span>
              {isLoading ? (
                <Skeleton width="40px" height="28px" />
              ) : (
                <span className="metric-value">{assignedCount}</span>
              )}
              <span className="metric-hint">Awaiting start</span>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="metric-card-content">
            <div className="metric-icon-box progress">
              <Clock size={22} />
            </div>
            <div className="metric-details">
              <span className="metric-label">In Progress</span>
              {isLoading ? (
                <Skeleton width="40px" height="28px" />
              ) : (
                <span className="metric-value">{inProgressCount}</span>
              )}
              <span className="metric-hint">Active work</span>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="metric-card-content">
            <div className="metric-icon-box submitted">
              <AlertTriangle size={22} />
            </div>
            <div className="metric-details">
              <span className="metric-label">Submitted</span>
              {isLoading ? (
                <Skeleton width="40px" height="28px" />
              ) : (
                <span className="metric-value">{submittedCount}</span>
              )}
              <span className="metric-hint">In review queue</span>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="metric-card-content">
            <div className="metric-icon-box approved">
              <CheckCircle size={22} />
            </div>
            <div className="metric-details">
              <span className="metric-label">Approved</span>
              {isLoading ? (
                <Skeleton width="40px" height="28px" />
              ) : (
                <span className="metric-value">{approvedCount}</span>
              )}
              <span className="metric-hint">10 pts awarded</span>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card points-card">
          <CardContent className="metric-card-content">
            <div className="metric-icon-box points">
              <Award size={22} />
            </div>
            <div className="metric-details">
              <span className="metric-label">Your Points</span>
              {isLoading ? (
                <Skeleton width="50px" height="28px" />
              ) : (
                <span className="metric-value points-val">{myPoints}</span>
              )}
              <span className="metric-hint">Rank: #{myRank}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Recent Tasks & Right Rail */}
      <div className="dashboard-main-grid">
        {/* Left Column: Recent Tasks */}
        <div className="dashboard-left-col">
          <Card>
            <CardHeader>
              <div className="card-header-flex">
                <div>
                  <CardTitle>Recent Tasks</CardTitle>
                  <CardDescription>
                    {roleTier <= 2
                      ? 'Live organization task activity across all teams'
                      : roleTier <= 4
                      ? 'Tasks assigned to your lead scope and teams'
                      : 'Tasks currently allocated to you and your assigned team'}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={onNavigateToTasks}>
                  View All ({totalTasks})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton height="48px" />
                  <Skeleton height="48px" />
                  <Skeleton height="48px" />
                </div>
              ) : recentTasks.length === 0 ? (
                <EmptyState
                  icon={<ListTodo size={32} />}
                  title="No Tasks Found"
                  description="There are currently no tasks allocated in this view scope."
                  action={
                    roleTier <= 3 ? (
                      <Button variant="primary" size="sm" onClick={onNavigateToTasks}>
                        Create First Task
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="recent-tasks-list">
                  {recentTasks.map((task) => (
                    <div key={task.task_id} className="recent-task-row">
                      <div className="recent-task-info">
                        <span className="recent-task-title">{task.title}</span>
                        <div className="recent-task-meta">
                          <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                          {task.assigned_to && (
                            <span>• Assignee: {task.assigned_to.name}</span>
                          )}
                          {task.team && (
                            <span>• Team: {task.team.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="recent-task-status">
                        <Badge status={task.status}>{task.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Announcements & Audit Feed */}
        <div className="dashboard-right-col">
          {/* Announcements Card */}
          <Card>
            <CardHeader>
              <div className="card-header-flex">
                <div className="header-with-icon">
                  <Megaphone size={18} className="text-primary" />
                  <CardTitle>Announcements</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton height="80px" />
              ) : announcements.length === 0 ? (
                <div className="empty-sub-state">
                  <p>No community announcements at this time.</p>
                </div>
              ) : (
                <div className="announcements-feed">
                  {announcements.slice(0, 3).map((item) => (
                    <div key={item.announcement_id} className="announcement-item">
                      <h4 className="announcement-title">{item.title}</h4>
                      <p className="announcement-content">{item.content}</p>
                      <div className="announcement-meta">
                        <span>By {item.created_by?.name}</span>
                        <span>• {new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity History Feed */}
          <Card>
            <CardHeader>
              <div className="card-header-flex">
                <div className="header-with-icon">
                  <History size={18} className="text-secondary" />
                  <CardTitle>Recent Audit Trail</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton height="80px" />
              ) : recentActivity.length === 0 ? (
                <div className="empty-sub-state">
                  <p>No activity logged yet.</p>
                </div>
              ) : (
                <div className="activity-feed">
                  {recentActivity.slice(0, 4).map((log) => (
                    <div key={log.log_id} className="activity-log-item">
                      <span className="activity-action-tag">{log.action}</span>
                      <p className="activity-details">{log.details}</p>
                      <span className="activity-time">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
