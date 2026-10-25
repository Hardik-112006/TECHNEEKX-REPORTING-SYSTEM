import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { AuthView } from './views/AuthView'
import { DashboardView } from './views/DashboardView'
import { TasksView } from './views/TasksView'
import { LeaderboardView } from './views/LeaderboardView'
import { TeamsView } from './views/TeamsView'
import { AnnouncementsView } from './views/AnnouncementsView'
import { ActivityLogsView } from './views/ActivityLogsView'
import { CareerProfileView } from './views/CareerProfileView'
import { HackathonsView } from './views/HackathonsView'
import { OfficialDocumentsView } from './views/OfficialDocumentsView'
import { AnalyticsView } from './views/AnalyticsView'
import { ApprovalsView } from './views/ApprovalsView'
import { SubmissionsReviewView } from './views/SubmissionsReviewView'

const AuthenticatedApp: React.FC = () => {
  const { user, roleName, logout, switchDemoUser } = useAuth()
  const [activeNav, setActiveNav] = useState<string>('dashboard')

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
      onNavigate={(id) => setActiveNav(id)}
      title={title}
      subtitle={subtitle}
      user={currentUserData}
      onLogout={logout}
      onRoleSwitch={handleRoleSwitch}
    >
      {/* Primary View Routing */}
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
            border: '3px solid rgba(37, 99, 235, 0.2)',
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
