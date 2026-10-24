import React, { useState, useEffect, useRef } from 'react'
import {
  Bell,
  Clock,
  AlertTriangle,
  Flame,
  CheckCheck,
  RotateCw,
  Info
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { notificationsApi } from '../../services/api'
import type { NotificationItem } from '../../types/api'
import './NotificationCenter.css'

export const NotificationCenter: React.FC = () => {
  const { roleTier } = useAuth()
  const isLead = roleTier <= 3

  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isSweeping, setIsSweeping] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSummary()
    // Periodic refresh every 60 seconds
    const timer = setInterval(loadSummary, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const loadSummary = async () => {
    try {
      const summary = await notificationsApi.getSummary()
      setUnreadCount(summary.unread_count)
      setNotifications(summary.recent || [])
    } catch {
      // Quiet fallback
    }
  }

  const handleMarkRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => (n.notification_id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Handle error
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // Handle error
    }
  }

  const handleTriggerSweep = async () => {
    setIsSweeping(true)
    try {
      await notificationsApi.triggerReminders()
      await loadSummary()
    } finally {
      setIsSweeping(false)
    }
  }

  const renderIcon = (type: string, severity: string) => {
    if (type === 'ESCALATION' || severity === 'critical') {
      return (
        <div className="notif-icon-box notif-icon-critical">
          <Flame size={16} />
        </div>
      )
    }
    if (type === 'TASK_OVERDUE' || severity === 'warning') {
      return (
        <div className="notif-icon-box notif-icon-warning">
          <AlertTriangle size={16} />
        </div>
      )
    }
    if (type === 'DEADLINE_APPROACHING') {
      return (
        <div className="notif-icon-box notif-icon-info">
          <Clock size={16} />
        </div>
      )
    }
    return (
      <div className="notif-icon-box notif-icon-info">
        <Info size={16} />
      </div>
    )
  }

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      const now = new Date()
      const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return d.toLocaleDateString()
    } catch {
      return ''
    }
  }

  return (
    <div className="notification-center-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) loadSummary()
        }}
        aria-label="Notifications"
        title="View Notifications & Reminders"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge-count">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notif-dropdown-header">
            <div className="notif-header-title">
              <span>Alerts & Reminders</span>
              {unreadCount > 0 && (
                <Badge variant="primary" size="sm">
                  {unreadCount} New
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-action-text-btn"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <CheckCheck size={28} style={{ margin: '0 auto 8px', color: '#10b981' }} />
                <p>You're all caught up!</p>
                <span className="text-xs text-secondary">
                  No pending reminders or active escalations.
                </span>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.notification_id}
                  className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                  onClick={() => !notif.is_read && handleMarkRead(notif.notification_id)}
                >
                  {renderIcon(notif.notification_type, notif.severity)}
                  <div className="notif-body">
                    <div className="notif-title-row">
                      <span className="notif-title">{notif.title}</span>
                      <span className="notif-time">{formatTime(notif.created_at)}</span>
                    </div>
                    <p className="notif-message">{notif.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {isLead && (
            <div className="notif-dropdown-footer">
              <span className="text-xs text-secondary">Workload Engine</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerSweep}
                disabled={isSweeping}
              >
                <RotateCw
                  size={12}
                  style={{
                    marginRight: 4,
                    animation: isSweeping ? 'spin 1s linear infinite' : 'none'
                  }}
                />
                {isSweeping ? 'Sweeping...' : 'Run Reminder Sweep'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
