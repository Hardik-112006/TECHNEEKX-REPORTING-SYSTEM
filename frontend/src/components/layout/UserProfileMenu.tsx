import React, { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  LogOut,
  User,
  Sliders
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { authApi } from '../../services/api'
import type { DemoAccount } from '../../types/api'
import './UserProfileMenu.css'

interface UserProfileMenuProps {
  name: string
  email: string
  role: string
  hierarchyLevel?: string
  position?: string | null
  groupName?: string | null
  onLogout?: () => void
  onRoleSwitch?: (email: string) => void
  onNavigate?: (navId: string) => void
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  name,
  email,
  role,
  hierarchyLevel,
  position,
  groupName,
  onLogout,
  onRoleSwitch,
  onNavigate
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showDevSwitcher, setShowDevSwitcher] = useState(false)
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (onRoleSwitch) {
      let isMounted = true
      authApi.getDemoAccounts()
        .then((accounts) => {
          if (isMounted) setDemoAccounts(accounts)
        })
        .catch(() => {})
      return () => { isMounted = false }
    }
  }, [onRoleSwitch])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const initial = name ? name[0].toUpperCase() : 'U'

  return (
    <div className="user-profile-menu-container" ref={containerRef}>
      <button
        type="button"
        className={`user-profile-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User profile options"
        aria-expanded={isOpen}
      >
        <div className="user-avatar-circle">{initial}</div>
        <div className="user-profile-info">
          <span className="user-profile-name">{name}</span>
          <div className="user-profile-role-row">
            <span className="user-role-badge-text">{position || role}</span>
          </div>
        </div>
        <ChevronDown size={14} className="user-profile-chevron" />
      </button>

      {isOpen && (
        <div className="user-profile-dropdown" role="menu">
          <div className="profile-dropdown-header">
            <div className="profile-header-name">{name}</div>
            <div className="profile-header-email">{email}</div>
            <div className="profile-header-badge-row">
              <Badge variant="primary" size="sm">
                {role}
              </Badge>
              {position && (
                <Badge variant="info" size="sm">
                  {position}
                </Badge>
              )}
              {groupName && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-border-subtle)',
                    padding: '2px 6px',
                    borderRadius: 4
                  }}
                >
                  {groupName}
                </span>
              )}
              {hierarchyLevel && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-border-subtle)',
                    padding: '2px 6px',
                    borderRadius: 4
                  }}
                >
                  {hierarchyLevel}
                </span>
              )}
            </div>
          </div>

          <div className="profile-dropdown-body">
            {onNavigate && (
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => {
                  setIsOpen(false)
                  onNavigate('career')
                }}
              >
                <User size={15} />
                <span>My Career Profile & ATS</span>
              </button>
            )}

            {/* Discreet development persona switcher only if supported */}
            {onRoleSwitch && (
              <div className="dev-persona-accordion">
                <div
                  className="dev-accordion-toggle"
                  onClick={() => setShowDevSwitcher(!showDevSwitcher)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sliders size={13} />
                    <span>Dev Account Switcher</span>
                  </span>
                  <ChevronDown
                    size={12}
                    style={{
                      transform: showDevSwitcher ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease'
                    }}
                  />
                </div>

                {showDevSwitcher && (
                  <div>
                    <select
                      className="dev-persona-select"
                      value={email}
                      onChange={(e) => {
                        onRoleSwitch(e.target.value)
                        setIsOpen(false)
                      }}
                      aria-label="Switch Persona for Testing"
                    >
                      {['Founder', 'Officials', 'Director of Core Operations', 'Core Leads', 'Members'].map((cat, idx) => {
                        const items = demoAccounts.filter((d) => d.category === cat)
                        if (items.length === 0) return null
                        return (
                          <optgroup key={cat} label={`${idx + 1}. ${cat}`}>
                            {items.map((acc) => (
                              <option key={acc.email} value={acc.email}>
                                {acc.label || `${acc.name} (${acc.role})`}
                              </option>
                            ))}
                          </optgroup>
                        )
                      })}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="profile-menu-divider" />

            {onLogout && (
              <button
                type="button"
                className="profile-menu-item danger"
                onClick={() => {
                  setIsOpen(false)
                  onLogout()
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
