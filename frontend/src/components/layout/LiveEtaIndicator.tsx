import React, { useState, useEffect, useRef } from 'react'
import { Clock, RefreshCw, AlertCircle, Calendar, Inbox } from 'lucide-react'
import { liveEtaApi } from '../../services/api'
import type { LiveEtaResponse } from '../../types/api'
import { Badge } from '../ui/Badge'
import './LiveEtaIndicator.css'

interface LiveEtaIndicatorProps {
  onNavigate?: (navId: string) => void
}

export const LiveEtaIndicator: React.FC<LiveEtaIndicatorProps> = ({ onNavigate }) => {
  const [data, setData] = useState<LiveEtaResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchLiveEta = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await liveEtaApi.getLiveEta()
      setData(res)
    } catch (err: any) {
      setError(err?.message || 'Unable to retrieve live ETA.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLiveEta()
    // Periodic refresh every 90 seconds
    const interval = setInterval(fetchLiveEta, 90000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  // Determine dot color & label
  const getStatusColor = () => {
    if (isLoading && !data) return 'dot-unavailable'
    if (error || !data || !data.has_eta) return 'dot-unavailable'
    if (data.is_overdue) return 'dot-critical'
    if (data.formatted_eta.includes('m remaining') || data.formatted_eta.includes('1h')) {
      return 'dot-warning'
    }
    return 'dot-normal'
  }

  const getPillLabel = () => {
    if (isLoading && !data) return 'Checking...'
    if (error) return 'ETA Unavailable'
    if (!data || !data.has_eta) return 'ETA Unavailable'
    return data.formatted_eta
  }

  return (
    <div className="live-eta-container" ref={containerRef}>
      <button
        type="button"
        className={`live-eta-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Live ETA details"
        aria-expanded={isOpen}
      >
        <span className={`eta-status-dot ${getStatusColor()}`} />
        <Clock size={14} />
        <span className="eta-trigger-text">
          <span className="eta-label">Live ETA:</span>
          <span className="eta-value">{getPillLabel()}</span>
        </span>
      </button>

      {isOpen && (
        <div className="live-eta-dropdown" role="dialog" aria-label="Live ETA Information">
          <div className="eta-dropdown-header">
            <div className="eta-header-title">
              <Clock size={16} className="text-primary" />
              <span>Deliverable Live ETA</span>
            </div>
            <div className="eta-header-actions">
              <button
                type="button"
                className="eta-refresh-btn"
                onClick={fetchLiveEta}
                disabled={isLoading}
                title="Refresh ETA"
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="eta-dropdown-body">
            {isLoading && !data ? (
              <div className="eta-loading-state">
                <RefreshCw size={20} className="animate-spin mb-2" style={{ margin: '0 auto 8px' }} />
                <p>Retrieving real-time ETA schedule...</p>
              </div>
            ) : error ? (
              <div className="eta-error-state">
                <AlertCircle size={24} style={{ color: 'var(--color-danger)', margin: '0 auto 8px' }} />
                <p>{error}</p>
                <button
                  type="button"
                  className="eta-refresh-btn"
                  style={{ marginTop: 10, marginInline: 'auto' }}
                  onClick={fetchLiveEta}
                >
                  Retry
                </button>
              </div>
            ) : !data || !data.has_eta ? (
              <div className="eta-empty-state">
                <Inbox size={28} className="eta-empty-icon" />
                <div className="eta-empty-text">
                  <strong>No Active Deliverable Deadlines</strong>
                  <p>There are no active tasks with scheduled deadlines currently assigned to you.</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="eta-active-card">
                  <div className="eta-active-badge-row">
                    <span className="eta-context-tag">{data.context || 'Active Task'}</span>
                    <Badge variant={data.is_overdue ? 'danger' : 'primary'} size="sm">
                      {data.status || 'In Progress'}
                    </Badge>
                  </div>

                  <h4 className="eta-active-title">
                    {data.task_title || `Task #${data.task_id}`}
                  </h4>

                  <div className="eta-active-meta">
                    <div className="eta-meta-item">
                      <Clock size={13} />
                      <span>Delivery Target:</span>
                      <span className={`eta-meta-highlight ${data.is_overdue ? 'is-overdue' : ''}`}>
                        {data.formatted_eta}
                      </span>
                    </div>

                    {data.deadline && (
                      <div className="eta-meta-item">
                        <Calendar size={13} />
                        <span>Deadline:</span>
                        <span>{new Date(data.deadline).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {data.task_id && onNavigate && (
                    <div className="eta-action-row">
                      <button
                        type="button"
                        className="eta-nav-btn"
                        onClick={() => {
                          setIsOpen(false)
                          onNavigate('tasks')
                        }}
                      >
                        View Task Details &rarr;
                      </button>
                    </div>
                  )}
                </div>

                {data.upcoming && data.upcoming.length > 1 && (
                  <div className="eta-upcoming-section">
                    <div className="eta-upcoming-heading">Other Upcoming Deliverables</div>
                    <div className="eta-upcoming-list">
                      {data.upcoming.slice(1).map((item) => (
                        <div key={item.task_id} className="eta-upcoming-item">
                          <span className="eta-upcoming-item-title" title={item.title}>
                            {item.title}
                          </span>
                          <span className="eta-upcoming-item-time">
                            {item.formatted_eta}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="eta-dropdown-footer">
            <span>
              Updated: {data?.last_updated ? new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
            </span>
            <span>Real-time DB Sync</span>
          </div>
        </div>
      )}
    </div>
  )
}
