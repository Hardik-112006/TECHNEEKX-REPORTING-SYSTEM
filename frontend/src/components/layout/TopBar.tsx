import React from 'react'
import { Menu } from 'lucide-react'
import { GlobalSearch } from './GlobalSearch'
import { LiveEtaIndicator } from './LiveEtaIndicator'
import { ThemeToggle } from './ThemeToggle'
import { UserProfileMenu } from './UserProfileMenu'
import './TopBar.css'

export interface TopBarProps {
  onToggleMobileMenu: () => void
  title: string
  subtitle?: string
  user?: {
    name: string
    email: string
    role: string
    hierarchyLevel?: string
    position?: string | null
    groupName?: string | null
  }
  onRoleSwitch?: (email: string) => void
  onLogout?: () => void
  onNavigate?: (navId: string) => void
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleMobileMenu,
  user = { name: 'Community Member', email: '', role: 'Member' },
  onRoleSwitch,
  onLogout,
  onNavigate
}) => {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <div
          className="topbar-brand-mark"
          onClick={() => onNavigate?.('dashboard')}
          title="TechNeekX Reporting System"
          role="button"
          tabIndex={0}
        >
          <img src="/tnxlogo.jpg" alt="TechNeekX Logo" className="topbar-logo-img" />
          <span className="topbar-brand-text">TechNeekX</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Real authorized global search */}
        <GlobalSearch onNavigate={onNavigate} />

        {/* Live ETA indicator replacing notification bell */}
        <LiveEtaIndicator onNavigate={onNavigate} />

        {/* Working Light/Dark theme toggle */}
        <ThemeToggle />

        {/* Clean authenticated user profile menu (no redundant header persona dropdown) */}
        <UserProfileMenu
          name={user.name}
          email={user.email}
          role={user.role}
          hierarchyLevel={user.hierarchyLevel}
          position={user.position}
          groupName={user.groupName}
          onLogout={onLogout}
          onRoleSwitch={onRoleSwitch}
          onNavigate={onNavigate}
        />
      </div>
    </header>
  )
}

