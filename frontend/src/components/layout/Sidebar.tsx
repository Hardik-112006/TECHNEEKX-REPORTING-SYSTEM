import React from 'react'
import {
  LayoutDashboard,
  CheckSquare,
  UploadCloud,
  Trophy,
  Users,
  Megaphone,
  Activity,
  X,
  Award,
  FileText,
  TrendingUp,
  ShieldCheck
} from 'lucide-react'
import './Sidebar.css'

export interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  badge?: string | number
  group?: 'main' | 'growth' | 'governance'
}

export interface SidebarProps {
  activeNav: string
  onNavigate: (navId: string) => void
  isOpen: boolean
  onCloseMobile: () => void
  user?: {
    name: string
    email: string
    role: string
  }
  onLogout?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavigate,
  isOpen,
  onCloseMobile,
  user = { name: 'Demo Official', email: 'official@example.com', role: 'Official' }
}) => {
  const role = user.role || 'Member'
  const isOfficial = ['Founder', 'Chairman', 'Managing Director', 'President', 'Official'].includes(role)
  const isBoard = ['Director of Core Operations'].includes(role)
  const isCoreTeam = ['Core Team Lead', 'Core Lead'].includes(role)

  // Primary Navigation
  const mainNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: isOfficial ? 'Executive Dashboard' : isBoard ? 'Board Monitoring' : isCoreTeam ? 'Group Dashboard' : 'My Workspace',
      icon: <LayoutDashboard size={18} />,
      group: 'main'
    },
    {
      id: 'tasks',
      label: isOfficial ? 'Tasks & Delegation' : isBoard ? 'Monitored Tasks' : isCoreTeam ? 'Group Tasks' : 'My Tasks',
      icon: <CheckSquare size={18} />,
      group: 'main'
    },
    {
      id: 'submissions',
      label: (isOfficial || isCoreTeam) ? 'Submissions Review' : isBoard ? 'Submissions Log' : 'My Submissions',
      icon: <UploadCloud size={18} />,
      group: 'main'
    },
    ...(isOfficial || isCoreTeam ? [
      {
        id: 'teams',
        label: isOfficial ? 'Teams & Groups' : 'My Group Roster',
        icon: <Users size={18} />,
        group: 'main' as const
      }
    ] : []),
    {
      id: 'announcements',
      label: 'Announcements',
      icon: <Megaphone size={18} />,
      group: 'main'
    }
  ]

  // Community & Growth Navigation
  const growthNavItems: NavItem[] = [
    {
      id: 'leaderboard',
      label: 'Community Leaderboard',
      icon: <Trophy size={18} />,
      group: 'growth'
    },
    {
      id: 'hackathons',
      label: 'Hackathons & Recruitment',
      icon: <Award size={18} />,
      group: 'growth'
    }
  ]

  // Governance & Administration Navigation
  const governanceNavItems: NavItem[] = [
    ...(isOfficial ? [
      { id: 'approvals', label: 'Governance Approvals', icon: <ShieldCheck size={18} />, group: 'governance' as const },
      { id: 'documents', label: 'Official Documents', icon: <FileText size={18} />, group: 'governance' as const }
    ] : []),
    ...(isOfficial || isBoard ? [
      { id: 'analytics', label: isOfficial ? 'Analytics & Reports' : 'Compliance Reports', icon: <TrendingUp size={18} />, group: 'governance' as const },
      { id: 'activity', label: 'Audit History', icon: <Activity size={18} />, group: 'governance' as const }
    ] : [])
  ]

  const renderNavList = (items: NavItem[]) => (
    <ul className="nav-list">
      {items.map((item) => {
        const isActive = activeNav === item.id
        return (
          <li key={item.id} className="nav-item">
            <button
              type="button"
              className={`nav-button ${isActive ? 'nav-button-active' : ''}`}
              onClick={() => {
                onNavigate(item.id)
                onCloseMobile()
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && <span className="nav-badge-pill">{item.badge}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand header */}
        <div className="sidebar-brand">
          <div className="brand-logo-wrapper">
            <img src="/tnxlogo.jpg" alt="TechNeekX Logo" className="brand-logo-img" />
          </div>
          <div className="brand-text-block">
            <h1 className="brand-title">TechNeekX</h1>
            <span className="brand-subtitle">Reporting System</span>
          </div>
          <button
            type="button"
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation sections */}
        <nav className="sidebar-nav">
          <div className="nav-section-block">
            <div className="nav-group-title">WORKSPACE</div>
            {renderNavList(mainNavItems)}
          </div>

          {growthNavItems.length > 0 && (
            <div className="nav-section-block">
              <div className="nav-group-title">COMMUNITY & GROWTH</div>
              {renderNavList(growthNavItems)}
            </div>
          )}

          {governanceNavItems.length > 0 && (
            <div className="nav-section-block">
              <div className="nav-group-title">GOVERNANCE & AUDIT</div>
              {renderNavList(governanceNavItems)}
            </div>
          )}
        </nav>
      </aside>
    </>
  )
}
