import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import './AppShell.css'

export interface AppShellProps {
  children: React.ReactNode
  activeNav: string
  onNavigate: (navId: string) => void
  title: string
  subtitle?: string
  user?: {
    name: string
    email: string
    role: string
    hierarchyLevel?: string
    category?: string
    position?: string | null
    groupName?: string | null
  }
  onLogout?: () => void
  onRoleSwitch?: (email: string) => void
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeNav,
  onNavigate,
  title,
  subtitle,
  user,
  onLogout,
  onRoleSwitch
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="app-shell-container">
      <Sidebar
        activeNav={activeNav}
        onNavigate={onNavigate}
        isOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        user={user}
        onLogout={onLogout}
      />
      <div className="app-shell-main">
        <TopBar
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          title={title}
          subtitle={subtitle}
          user={user}
          onLogout={onLogout}
          onRoleSwitch={onRoleSwitch}
          onNavigate={onNavigate}
        />
        <main className="app-shell-content">
          <div className="content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
