import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Megaphone,
  Plus,
  RefreshCw,
  Calendar,
  User,
  Search,
  Pin,
  Paperclip,
  ExternalLink,
  FileText,
  Upload,
  X,
  FolderOpen
} from 'lucide-react'
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Textarea,
  Select,
  Modal,
  Alert,
  Skeleton,
  EmptyState
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { announcementsApi } from '../services/api'
import type { Announcement } from '../types/api'
import './AnnouncementsView.css'

const CATEGORIES = [
  'General Announcement',
  'Event',
  'Meeting',
  'Deadline',
  'Important Notice',
  'Documents & Resources',
  'Achievement',
  'Other'
] as const

export const AnnouncementsView: React.FC = () => {
  const { user, roleTier, roleName } = useAuth()
  
  // Authorized publishers: Founder and Officials (Level 1 / Tier <= 2)
  const isAuthorizedPublisher =
    user?.hierarchy_level === 1 ||
    ['Founder', 'Chairman', 'Managing Director', 'President', 'Official'].includes(roleName) ||
    roleTier <= 2

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

  // Creation modal state (Founder and Authorized Officials only)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [title, setTitle] = useState<string>('')
  const [category, setCategory] = useState<string>('General Announcement')
  const [content, setContent] = useState<string>('')
  const [externalLink, setExternalLink] = useState<string>('')
  const [driveLink, setDriveLink] = useState<string>('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAnnouncements = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await announcementsApi.getAnnouncements(1)
      const rawList: Announcement[] = res.results || (Array.isArray(res) ? res : [])

      const seen = new Set<number>()
      const dedupedList: Announcement[] = []
      for (const item of rawList) {
        if (!seen.has(item.announcement_id)) {
          seen.add(item.announcement_id)
          dedupedList.push(item)
        }
      }

      setAnnouncements(dedupedList)
    } catch (err: any) {
      setError(err?.message || 'Failed to load announcements.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10 MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setFormError('File exceeds the maximum allowed size of 10MB.')
      return
    }

    setFormError(null)
    setAttachmentFile(file)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setFormError('Title and announcement content are required.')
      return
    }

    setFormError(null)
    setIsPosting(true)

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('category', category)
      formData.append('content', content.trim())

      if (externalLink.trim()) {
        formData.append('external_link', externalLink.trim())
      }
      if (driveLink.trim()) {
        formData.append('drive_link', driveLink.trim())
      }
      if (attachmentFile) {
        formData.append('attachment', attachmentFile)
      }

      await announcementsApi.createAnnouncement(formData)
      setSuccessBanner('Official announcement published successfully.')
      setIsOpen(false)
      setTitle('')
      setCategory('General Announcement')
      setContent('')
      setExternalLink('')
      setDriveLink('')
      setAttachmentFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadAnnouncements()
    } catch (err: any) {
      setFormError(err?.message || 'Failed to publish announcement.')
    } finally {
      setIsPosting(false)
    }
  }

  const getCategoryBadgeVariant = (cat?: string) => {
    switch (cat) {
      case 'Important Notice':
        return 'danger'
      case 'Deadline':
        return 'warning'
      case 'Achievement':
        return 'success'
      case 'Documents & Resources':
        return 'info'
      default:
        return 'primary'
    }
  }

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const matchesCategory =
        selectedCategory === 'ALL' || item.category === selectedCategory
      if (!matchesCategory) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.created_by?.name || '').toLowerCase().includes(q)
      )
    })
  }, [announcements, searchQuery, selectedCategory])

  return (
    <div className="announcements-view">
      {/* Page Header */}
      <div className="announcements-header-row">
        <div className="announcements-header-left">
          <h1 className="announcements-view-title">Community Announcements</h1>
          <p className="announcements-view-subtitle">
            Official broadcasts, sprint deadlines, resources, and leadership directives.
          </p>
        </div>
        <div className="announcements-header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnnouncements}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          {isAuthorizedPublisher && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setFormError(null)
                setIsOpen(true)
              }}
              leftIcon={<Plus size={16} />}
            >
              Post Announcement
            </Button>
          )}
        </div>
      </div>

      {successBanner && (
        <Alert
          variant="success"
          title="Success"
          description={successBanner}
          onClose={() => setSuccessBanner(null)}
        />
      )}

      {error && (
        <Alert
          variant="danger"
          title="Notice"
          description={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Toolbar with Search and Category Filter */}
      <div className="announcements-toolbar">
        <div className="announcements-search-wrap">
          <Search size={15} className="announcements-search-icon" />
          <input
            type="text"
            className="announcements-search-input"
            placeholder="Search bulletins by title, keyword, author, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="announcements-category-filter">
          <select
            className="announcements-filter-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="ALL">All Categories ({announcements.length})</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <span className="announcements-stats-pill">
          Showing {filteredAnnouncements.length} of {announcements.length} bulletins
        </span>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height="130px" />
          <Skeleton height="130px" />
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <Card>
          <CardContent style={{ padding: '48px 24px', textAlign: 'center' }}>
            <EmptyState
              icon={<Megaphone size={36} style={{ color: 'var(--color-text-muted)' }} />}
              title="No Announcements Found"
              description={
                announcements.length === 0
                  ? 'No official announcements have been published yet.'
                  : `No announcements match the selected category or query "${searchQuery}".`
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="announcements-list">
          {filteredAnnouncements.map((item, idx) => {
            const isLatest = idx === 0
            const attachmentUrl = item.attachment_url || item.attachment
            return (
              <article
                key={item.announcement_id}
                className={`announcement-card ${isLatest ? 'is-important' : ''}`}
              >
                <div className="announcement-card-header">
                  <div className="announcement-title-row">
                    <h3 className="announcement-card-title">{item.title}</h3>
                    {item.category && (
                      <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
                        {item.category}
                      </Badge>
                    )}
                    {isLatest && (
                      <Badge variant="primary" size="sm">
                        <Pin size={11} style={{ marginRight: 4 }} /> Latest
                      </Badge>
                    )}
                  </div>

                  <div className="announcement-card-meta">
                    <span className="announcement-meta-item">
                      <User size={13} />
                      <strong>{item.created_by?.name || 'Executive Leadership'}</strong>
                    </span>
                    <span>•</span>
                    <span className="announcement-meta-item">
                      <Calendar size={13} />
                      {new Date(item.created_at).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                <div className="announcement-card-body">
                  <p className="announcement-message-text">{item.content}</p>

                  {/* Attachments and External Links */}
                  {(attachmentUrl || item.external_link || item.drive_link) && (
                    <div className="announcement-attachments-strip">
                      {attachmentUrl && (
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-pill-btn file-pill"
                          title="View / Download Attached Document"
                        >
                          <Paperclip size={13} />
                          <span>
                            {item.attachment_name || 'Download Document'}
                          </span>
                        </a>
                      )}

                      {item.drive_link && (
                        <a
                          href={item.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-pill-btn drive-pill"
                          title="Open Google Drive Link"
                        >
                          <FolderOpen size={13} />
                          <span>Google Drive Folder / Doc</span>
                          <ExternalLink size={11} />
                        </a>
                      )}

                      {item.external_link && (
                        <a
                          href={item.external_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-pill-btn link-pill"
                          title="Open External Resource"
                        >
                          <ExternalLink size={13} />
                          <span>External Resource</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Post Announcement Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Publish Official Announcement"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form-layout">
          {formError && (
            <Alert
              variant="danger"
              title="Error"
              description={formError}
              onClose={() => setFormError(null)}
            />
          )}

          <div className="announcement-form-grid">
            <Input
              label="Announcement Title *"
              placeholder="e.g. Q4 Sprint Review Window & Submission Guidelines"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <Select
              label="Category *"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
              required
            />
          </div>

          <Textarea
            label="Announcement Message *"
            placeholder="Write clear instructions, timelines, directives, or announcements..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            required
          />

          <div className="announcement-form-grid">
            <Input
              label="External Reference Link (Optional)"
              type="url"
              placeholder="https://example.com/resources"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
            />

            <Input
              label="Google Drive Link (Optional)"
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
            />
          </div>

          <div className="announcement-file-upload-block">
            <label className="form-label">
              Upload Document / Attachment (PDF, Image, Docs — Max 10MB)
            </label>
            <div className="file-upload-input-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="announcement-file-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<Upload size={14} />}
              >
                Choose File
              </Button>

              {attachmentFile ? (
                <div className="selected-file-chip">
                  <FileText size={14} className="text-primary" />
                  <span className="file-name">{attachmentFile.name}</span>
                  <span className="file-size">
                    ({(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    className="file-remove-btn"
                    onClick={() => {
                      setAttachmentFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    title="Remove file"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <span className="file-hint-text">No file chosen</span>
              )}
            </div>
          </div>

          <div className="modal-button-footer">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isPosting}>
              Publish Announcement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
