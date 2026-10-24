import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DEMO_USERS } from './types/api'
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
import { ComponentsShowcaseView } from './views/ComponentsShowcaseView'
import { Button } from './components/ui'
import { Sparkles, LogOut } from 'lucide-react'

const AuthenticatedApp: React.FC = () => {
  const { user, roleName, roleTier, logout, switchDemoUser } = useAuth()
  const [activeNav, setActiveNav] = useState<string>('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSwitching, setIsSwitching] = useState(false)

  const handleRoleSwitch = async (email: string) => {
    setIsSwitching(true)
    try {
      await switchDemoUser(email)
    } finally {
      setIsSwitching(false)
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
      case 'components':
        return {
          title: 'Design System & Component Library',
          subtitle: 'Accessible UI primitives matching SaaS tokens'
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
    role: roleName
  }

  return (
    <AppShell
      activeNav={activeNav}
      onNavigate={(id) => setActiveNav(id)}
      title={title}
      subtitle={subtitle}
      user={currentUserData}
      onLogout={logout}
      onSearchChange={(val) => setSearchTerm(val)}
      searchValue={searchTerm}
    >
      {/* Live Role Switcher Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--color-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            Live Persona Authenticator:
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Logged in as <strong>{user?.name}</strong> (Tier {roleTier})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {DEMO_USERS.slice(0, 4).map((demo) => {
            const isCurrent = user?.email === demo.email
            return (
              <Button
                key={demo.email}
                size="sm"
                variant={isCurrent ? 'primary' : 'secondary'}
                isLoading={isSwitching && isCurrent}
                onClick={() => handleRoleSwitch(demo.email)}
              >
                {demo.role}
              </Button>
            )
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveNav('components')}
          >
            UI Showcase
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={logout}
            title="Sign Out"
            leftIcon={<LogOut size={12} />}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Primary View Routing */}
      {activeNav === 'dashboard' && (
        <DashboardView onNavigateToTasks={() => setActiveNav('tasks')} />
      )}
      {activeNav === 'tasks' && <TasksView />}
      {activeNav === 'leaderboard' && <LeaderboardView />}
      {activeNav === 'career' && <CareerProfileView />}
      {activeNav === 'hackathons' && <HackathonsView />}
      {activeNav === 'teams' && <TeamsView />}
      {activeNav === 'announcements' && <AnnouncementsView />}
      {activeNav === 'activity' && <ActivityLogsView />}
      {activeNav === 'components' && <ComponentsShowcaseView />}
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
            border: '3px solid rgba(99, 91, 255, 0.2)',
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
