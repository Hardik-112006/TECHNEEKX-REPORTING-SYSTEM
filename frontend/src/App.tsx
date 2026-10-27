import React, { Suspense, lazy, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { AuthView } from './views/AuthView'
import { Skeleton } from './components/ui'

// Views are code-split so the initial download only contains the shell and the
// active page; each module loads on first navigation.
const DashboardView = lazy(() => import('./views/DashboardView').then((m) => ({ default: m.DashboardView })))
const TasksView = lazy(() => import('./views/TasksView').then((m) => ({ default: m.TasksView })))
const LeaderboardView = lazy(() => import('./views/LeaderboardView').then((m) => ({ default: m.LeaderboardView })))
const TeamsView = lazy(() => import('./views/TeamsView').then((m) => ({ default: m.TeamsView })))
const AnnouncementsView = lazy(() => import('./views/AnnouncementsView').then((m) => ({ default: m.AnnouncementsView })))
const ActivityLogsView = lazy(() => import('./views/ActivityLogsView').then((m) => ({ default: m.ActivityLogsView })))
const CareerProfileView = lazy(() => import('./views/CareerProfileView').then((m) => ({ default: m.CareerProfileView })))
const HackathonsView = lazy(() => import('./views/HackathonsView').then((m) => ({ default: m.HackathonsView })))
const OfficialDocumentsView = lazy(() => import('./views/OfficialDocumentsView').then((m) => ({ default: m.OfficialDocumentsView })))
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })))
const ApprovalsView = lazy(() => import('./views/ApprovalsView').then((m) => ({ default: m.ApprovalsView })))
const SubmissionsReviewView = lazy(() => import('./views/SubmissionsReviewView').then((m) => ({ default: m.SubmissionsReviewView })))
const UserManagementView = lazy(() => import('./views/UserManagementView').then((m) => ({ default: m.UserManagementView })))

const ViewFallback: React.FC = () => (
  <div aria-busy="true" aria-label="Loading page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <Skeleton height="36px" width="40%" />
    <Skeleton height="120px" />
    <Skeleton height="240px" />
  </div>
)

const AuthenticatedApp: React.FC = () => {
  const { user, roleName, logout, switchDemoUser } = useAuth()
  const [activeNav, setActiveNav] = useState<string>('dashboard')
  // Re-selecting the current page remounts it so its data is fetched fresh
  const [viewVersion, setViewVersion] = useState<number>(0)
  const navigate = (id: string) => {
    if (id === activeNav) setViewVersion((v) => v + 1)
    else setActiveNav(id)
  }

  const handleRoleSwitch = async (email: string) => {
    try {
      await switchDemoUser(email)
    } catch (err) {
      console.error('Failed to switch role persona:', err)
    }
  }

  const getPageInfo = () => {
    switch (activeNav) {
      case 'dashboard':
        return {
          title: 'Executive Dashboard',
          subtitle: 'Live task metrics, allocations, and verified deliverables'
        }
      case 'tasks':
        return {
          title: 'Tasks & Workflow Management',
          subtitle: 'State transitions: Assigned → In Progress → Submitted → Approved'
        }
      case 'submissions':
        return {
          title: 'Submission Review',
          subtitle: 'Inspect submitted proofs, verify evidence links, and conduct peer and official reviews'
        }
      case 'leaderboard':
        return {
          title: 'Community Leaderboard',
          subtitle: 'Live ranking standings and tamper-proof points ledger'
        }
      case 'career':
        return {
          title: 'Career Profile & ATS Resume',
          subtitle: 'Verified credentials, portfolio showcase, and ATS-optimized document builder'
        }
      case 'hackathons':
        return {
          title: 'Hackathons & Recruitment',
          subtitle: 'National competitions, certificate verification, live leaderboards, and candidate selection'
        }
      case 'documents':
        return {
          title: 'Official Documents & Partnerships',
          subtitle: 'Resource repositories, legal MoUs, event & sponsorship proposals, and partner network'
        }
      case 'analytics':
        return {
          title: 'Advanced Analytics & Intelligence',
          subtitle: 'Data-backed performance trends, bottleneck diagnostics, and multi-format report exports'
        }
      case 'approvals':
        return {
          title: 'Multi-Level Approvals & Governance',
          subtitle: 'Sequential verification: Stage 1 Lead Review → Stage 2 Executive Sign-off'
        }
      case 'users':
        return {
          title: 'Members & Roles',
          subtitle: 'Registration approvals, role assignments, and announcement permissions'
        }
      case 'teams':
        return {
          title: 'Teams & Groups Architecture',
          subtitle: 'Hierarchical team structures, sub-teams, and roster assignments'
        }
      case 'announcements':
        return {
          title: 'Community Announcements',
          subtitle: 'Official broadcasts and sprint milestones'
        }
      case 'activity':
        return {
          title: 'System Audit History',
          subtitle: 'Immutable audit trail of actions, state shifts, and scoring'
        }
      default:
        return {
          title: 'TechNeekX Platform',
          subtitle: 'Community Reporting & Task Management'
        }
    }
  }

  const { title, subtitle } = getPageInfo()

  const currentUserData = {
    name: user?.name || 'Community Member',
    email: user?.email || '',
    role: roleName,
    hierarchyLevel: user?.hierarchy_level ? `Level ${user.hierarchy_level}` : undefined,
    category: user?.category,
    position: user?.position,
    groupName: user?.group_name
  }

  return (
    <AppShell
      activeNav={activeNav}
      onNavigate={navigate}
      title={title}
      subtitle={subtitle}
      user={currentUserData}
      onLogout={logout}
      onRoleSwitch={handleRoleSwitch}
    >
      {/* Primary View Routing */}
      <Suspense fallback={<ViewFallback />}>
      <React.Fragment key={`${activeNav}-${viewVersion}`}>
      {activeNav === 'dashboard' && (
        <DashboardView
          onNavigateToTasks={() => setActiveNav('tasks')}
          onNavigateToTeams={() => setActiveNav('teams')}
          onNavigateToAnnouncements={() => setActiveNav('announcements')}
        />
      )}
      {activeNav === 'tasks' && <TasksView />}
      {activeNav === 'submissions' && <SubmissionsReviewView onNavigate={(id) => setActiveNav(id)} />}
      {activeNav === 'leaderboard' && <LeaderboardView />}
      {activeNav === 'career' && <CareerProfileView />}
      {activeNav === 'hackathons' && <HackathonsView />}
      {activeNav === 'documents' && <OfficialDocumentsView />}
      {activeNav === 'analytics' && <AnalyticsView />}
      {activeNav === 'approvals' && <ApprovalsView />}
      {activeNav === 'teams' && <TeamsView />}
      {activeNav === 'announcements' && <AnnouncementsView />}
      {activeNav === 'activity' && <ActivityLogsView />}
      {activeNav === 'users' && <UserManagementView />}
      </React.Fragment>
      </Suspense>
    </AppShell>
  )
}

const AppRoot: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: 'var(--color-bg-app)'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(var(--rgb-primary), 0.2)',
            borderTopColor: 'var(--color-primary)',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          Connecting to TechNeekX backend...
        </span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthView />
  }

  return <AuthenticatedApp />
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  )
}

export default App
