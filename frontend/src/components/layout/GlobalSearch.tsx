import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  X,
  Loader2,
  CheckSquare,
  Users,
  Megaphone,
  UploadCloud,
  ExternalLink,
  AlertCircle
} from 'lucide-react'
import { searchApi } from '../../services/api'
import type { SearchResults, SearchItem } from '../../types/api'
import './GlobalSearch.css'

interface GlobalSearchProps {
  onNavigate?: (navId: string) => void
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      setResults(null)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        const data = await searchApi.search(trimmed)
        setResults(data)
        setSelectedIndex(-1)
      } catch (err: any) {
        setError(err?.message || 'Search failed. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [query])

  // Click outside to close
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // Flatten results for keyboard navigation
  const allItems: SearchItem[] = results
    ? [
        ...(results.results.tasks || []),
        ...(results.results.teams || []),
        ...(results.results.members || []),
        ...(results.results.announcements || []),
        ...(results.results.submissions || [])
      ]
    : []

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < allItems.length) {
        handleSelectItem(allItems[selectedIndex])
      }
    }
  }

  const handleSelectItem = (item: SearchItem) => {
    setIsOpen(false)
    if (onNavigate && item.target_nav) {
      onNavigate(item.target_nav)
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults(null)
    setError(null)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="global-search-container" ref={containerRef} onKeyDown={handleKeyDown}>
      <div className="search-input-wrapper">
        <Search size={15} className="search-icon-left" />
        <input
          ref={inputRef}
          type="text"
          className="global-search-input"
          placeholder="Search tasks, teams, members..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true)
          }}
          aria-label="Search records"
          aria-expanded={isOpen}
          role="combobox"
          aria-autocomplete="list"
        />

        {isLoading ? (
          <Loader2 size={16} className="search-loading-spinner" />
        ) : query ? (
          <button
            type="button"
            className="search-action-btn"
            onClick={handleClear}
            aria-label="Clear search query"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="search-results-dropdown" role="listbox">
          <div className="search-dropdown-header">
            <span>Search Results for "{query.trim()}"</span>
            {results && <span>{results.total_results} found</span>}
          </div>

          {isLoading && !results ? (
            <div className="search-state-message">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span>Searching authorized records...</span>
            </div>
          ) : error ? (
            <div className="search-state-message">
              <AlertCircle size={24} style={{ color: 'var(--color-danger)' }} />
              <strong>{error}</strong>
              <button
                type="button"
                className="search-action-btn"
                style={{ width: 'auto', padding: '4px 8px', borderRadius: 4 }}
                onClick={() => setQuery(query + ' ')}
              >
                Retry
              </button>
            </div>
          ) : !results || results.total_results === 0 ? (
            <div className="search-state-message">
              <Search size={28} style={{ color: 'var(--color-text-muted)' }} />
              <strong>No matching records found</strong>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Try searching by task title, group name, member name, or bulletin keyword.
              </p>
            </div>
          ) : (
            <div>
              {/* Tasks Section */}
              {results.results.tasks && results.results.tasks.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <CheckSquare size={13} />
                    <span>Tasks ({results.results.tasks.length})</span>
                  </div>
                  {results.results.tasks.map((task, idx) => {
                    const itemGlobalIndex = idx
                    const isSelected = selectedIndex === itemGlobalIndex
                    return (
                      <div
                        key={`task-${task.id}`}
                        className={`search-result-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleSelectItem(task)}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="search-item-left">
                          <div className="search-item-icon">
                            <CheckSquare size={14} />
                          </div>
                          <div className="search-item-text">
                            <div className="search-item-title">{task.title}</div>
                            <div className="search-item-subtitle">{task.subtitle}</div>
                          </div>
                        </div>
                        <ExternalLink size={13} style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Teams & Groups Section */}
              {results.results.teams && results.results.teams.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <Users size={13} />
                    <span>Teams & Groups ({results.results.teams.length})</span>
                  </div>
                  {results.results.teams.map((tm) => (
                    <div
                      key={`team-${tm.id}`}
                      className="search-result-item"
                      onClick={() => handleSelectItem(tm)}
                      role="option"
                    >
                      <div className="search-item-left">
                        <div className="search-item-icon">
                          <Users size={14} />
                        </div>
                        <div className="search-item-text">
                          <div className="search-item-title">{tm.title}</div>
                          <div className="search-item-subtitle">{tm.subtitle}</div>
                        </div>
                      </div>
                      <ExternalLink size={13} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Members Section */}
              {results.results.members && results.results.members.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <Users size={13} />
                    <span>Members ({results.results.members.length})</span>
                  </div>
                  {results.results.members.map((m) => (
                    <div
                      key={`member-${m.id}`}
                      className="search-result-item"
                      onClick={() => handleSelectItem(m)}
                      role="option"
                    >
                      <div className="search-item-left">
                        <div
                          className="search-item-icon"
                          style={{
                            background: '#EFF6FF',
                            color: '#2563EB',
                            fontWeight: 700,
                            fontSize: 12
                          }}
                        >
                          {m.title ? m.title[0].toUpperCase() : 'M'}
                        </div>
                        <div className="search-item-text">
                          <div className="search-item-title">{m.title}</div>
                          <div className="search-item-subtitle">{m.subtitle}</div>
                        </div>
                      </div>
                      <ExternalLink size={13} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Announcements Section */}
              {results.results.announcements && results.results.announcements.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <Megaphone size={13} />
                    <span>Announcements ({results.results.announcements.length})</span>
                  </div>
                  {results.results.announcements.map((a) => (
                    <div
                      key={`ann-${a.id}`}
                      className="search-result-item"
                      onClick={() => handleSelectItem(a)}
                      role="option"
                    >
                      <div className="search-item-left">
                        <div className="search-item-icon">
                          <Megaphone size={14} />
                        </div>
                        <div className="search-item-text">
                          <div className="search-item-title">{a.title}</div>
                          <div className="search-item-subtitle">{a.subtitle}</div>
                        </div>
                      </div>
                      <ExternalLink size={13} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Submissions Section */}
              {results.results.submissions && results.results.submissions.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <UploadCloud size={13} />
                    <span>Submissions ({results.results.submissions.length})</span>
                  </div>
                  {results.results.submissions.map((s) => (
                    <div
                      key={`sub-${s.id}`}
                      className="search-result-item"
                      onClick={() => handleSelectItem(s)}
                      role="option"
                    >
                      <div className="search-item-left">
                        <div className="search-item-icon">
                          <UploadCloud size={14} />
                        </div>
                        <div className="search-item-text">
                          <div className="search-item-title">{s.title}</div>
                          <div className="search-item-subtitle">{s.subtitle}</div>
                        </div>
                      </div>
                      <ExternalLink size={13} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="search-dropdown-footer">
            <div className="search-shortcuts">
              <span>Navigate <span className="search-kbd">&uarr;</span> <span className="search-kbd">&darr;</span></span>
              <span>Open <span className="search-kbd">&crarr;</span></span>
              <span>Close <span className="search-kbd">Esc</span></span>
            </div>
            <span>TechNeekX Live Index</span>
          </div>
        </div>
      )}
    </div>
  )
}
