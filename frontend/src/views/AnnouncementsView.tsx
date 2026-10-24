import React, { useState, useEffect } from 'react'
import { Megaphone, Plus, RefreshCw, Calendar, User } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Textarea,
  Modal,
  Alert,
  Skeleton,
  EmptyState,
  Breadcrumbs
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { announcementsApi } from '../services/api'
import type { Announcement } from '../types/api'

export const AnnouncementsView: React.FC = () => {
  const { roleTier } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Creation modal state (Tier 1-3)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [title, setTitle] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [isPosting, setIsPosting] = useState<boolean>(false)

  const loadAnnouncements = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await announcementsApi.getAnnouncements(1)
      setAnnouncements(res.results || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load announcements.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setIsPosting(true)
    try {
      await announcementsApi.createAnnouncement({
        title: title.trim(),
        content: content.trim()
      })
      setSuccessBanner('Announcement published successfully.')
      setIsOpen(false)
      setTitle('')
      setContent('')
      loadAnnouncements()
    } catch (err: any) {
      setError(err?.message || 'Failed to publish announcement.')
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Community' }, { label: 'Announcements' }]} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Announcements</h1>
          <p className="text-sm text-gray-500">Official bulletins, sprint milestones, and team updates.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnnouncements}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          {roleTier <= 3 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsOpen(true)}
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
          title="Notice"
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

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton height="100px" />
          <Skeleton height="100px" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState
              icon={<Megaphone size={32} />}
              title="No Announcements"
              description="No public community bulletins have been published yet."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <Card key={item.announcement_id}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>{item.title}</CardTitle>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <User size={12} /> {item.created_by?.name || 'Leadership'}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} /> {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {item.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Post Announcement Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Publish Community Announcement"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form-layout">
          <Input
            label="Announcement Title *"
            placeholder="e.g. Q4 Sprint Deliverables Review Window"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Textarea
            label="Announcement Details *"
            placeholder="Write clear instructions, timelines, or community notices..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            required
          />

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
