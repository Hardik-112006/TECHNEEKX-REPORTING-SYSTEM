import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Alert } from '../components/ui/Alert'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { careerApi } from '../services/api'
import type {
  CareerProfile,
  ResumeConfiguration
} from '../types/api'
import './CareerProfileView.css'

export const CareerProfileView: React.FC = () => {
  const [profile, setProfile] = useState<CareerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'projects' | 'contributions' | 'resume'>('profile')
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  // Modals state
  const [showEduModal, setShowEduModal] = useState(false)
  const [showProjModal, setShowProjModal] = useState(false)
  const [showAchModal, setShowAchModal] = useState(false)

  // Education form state
  const [eduForm, setEduForm] = useState({
    institution: '',
    degree: '',
    field_of_study: '',
    graduation_year: 2026,
    grade: '',
    description: ''
  })

  // Project form state
  const [projForm, setProjForm] = useState({
    title: '',
    description: '',
    technologies: '',
    github_link: '',
    live_url: '',
    is_featured: false,
    include_in_resume: true
  })

  // Achievement form state
  const [achForm, setAchForm] = useState({
    title: '',
    issuer: '',
    issue_date: '',
    credential_url: '',
    description: '',
    include_in_resume: true
  })

  // Profile basic details editable state
  const [profileForm, setProfileForm] = useState({
    headline: '',
    target_role: '',
    target_company: '',
    experience_years: 0,
    bio: '',
    skills: '',
    phone: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    location: '',
    visibility: 'Community' as 'Public' | 'Community' | 'Private'
  })

  // Resume configuration state
  const [resumeConfig, setResumeConfig] = useState<Partial<ResumeConfiguration>>({
    template_style: 'Modern ATS',
    custom_headline: '',
    include_summary: true,
    include_education: true,
    include_projects: true,
    include_skills: true,
    include_achievements: true,
    include_community_contributions: true
  })

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const data = await careerApi.getProfile()
      setProfile(data)
      setProfileForm({
        headline: data.headline || '',
        target_role: data.target_role || '',
        target_company: data.target_company || '',
        experience_years: Number(data.experience_years) || 0,
        bio: data.bio || '',
        skills: Array.isArray(data.skills) ? data.skills.join(', ') : '',
        phone: data.phone || '',
        linkedin_url: data.linkedin_url || '',
        github_url: data.github_url || '',
        portfolio_url: data.portfolio_url || '',
        location: data.location || '',
        visibility: data.visibility || 'Community'
      })
      if (data.resume_config) {
        setResumeConfig(data.resume_config)
      }
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to load career profile' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const updated = await careerApi.updateProfile({
        ...profileForm,
        skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean)
      } as any)
      setProfile(updated)
      setStatusMessage({ type: 'success', text: 'Career profile updated successfully!' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to save profile' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddEducation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await careerApi.addEducation(eduForm)
      setShowEduModal(false)
      setEduForm({
        institution: '',
        degree: '',
        field_of_study: '',
        graduation_year: 2026,
        grade: '',
        description: ''
      })
      fetchProfile()
      setStatusMessage({ type: 'success', text: 'Education record added.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to add education' })
    }
  }

  const handleDeleteEducation = async (id: number) => {
    if (!window.confirm('Remove this education record?')) return
    try {
      await careerApi.deleteEducation(id)
      fetchProfile()
      setStatusMessage({ type: 'success', text: 'Education record removed.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to remove education' })
    }
  }

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await careerApi.addProject({
        ...projForm,
        order: 0
      })
      setShowProjModal(false)
      setProjForm({
        title: '',
        description: '',
        technologies: '',
        github_link: '',
        live_url: '',
        is_featured: false,
        include_in_resume: true
      })
      fetchProfile()
      setStatusMessage({ type: 'success', text: 'Project added to portfolio.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to add project' })
    }
  }

  const handleDeleteProject = async (id: number) => {
    if (!window.confirm('Delete this project?')) return
    try {
      await careerApi.deleteProject(id)
      fetchProfile()
      setStatusMessage({ type: 'success', text: 'Project removed.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to remove project' })
    }
  }

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await careerApi.addAchievement(achForm)
      setShowAchModal(false)
      setAchForm({
        title: '',
        issuer: '',
        issue_date: '',
        credential_url: '',
        description: '',
        include_in_resume: true
      })
      fetchProfile()
      setStatusMessage({ type: 'success', text: 'Achievement record added.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to add achievement' })
    }
  }

  const handleDeleteAchievement = async (id: number) => {
    if (!window.confirm('Delete this achievement?')) return
    try {
      await careerApi.deleteAchievement(id)
      fetchProfile()
      setStatusMessage({ type: 'success', text: 'Achievement removed.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to remove achievement' })
    }
  }

  const handleSyncContributions = async () => {
    try {
      setSyncing(true)
      const res = await careerApi.syncContributions()
      fetchProfile()
      setStatusMessage({ type: 'success', text: res.message || 'Contributions synced successfully.' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to sync contributions' })
    } finally {
      setSyncing(false)
    }
  }

  const handleToggleContribution = async (id: number) => {
    try {
      await careerApi.toggleContribution(id)
      fetchProfile()
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to toggle contribution' })
    }
  }

  const handleSaveResumeConfig = async () => {
    try {
      await careerApi.updateResumeConfig(resumeConfig)
      setStatusMessage({ type: 'success', text: 'Resume sections updated!' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to update resume config' })
    }
  }

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true)
      const blob = await careerApi.downloadResumePdf()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${profile?.user_name.replace(/\s+/g, '_') || 'Member'}_ATS_Resume.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setStatusMessage({ type: 'success', text: 'ATS Resume PDF downloaded successfully!' })
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: err.message || 'Failed to download resume' })
    } finally {
      setDownloading(false)
    }
  }

  const copyShareLink = () => {
    if (!profile?.shareable_slug) return
    const shareUrl = `${window.location.origin}/career/public/${profile.shareable_slug}`
    navigator.clipboard.writeText(shareUrl)
    setStatusMessage({ type: 'success', text: 'Portfolio link copied to clipboard!' })
  }

  if (loading) {
    return (
      <div className="career-page-container">
        <Skeleton height="60px" style={{ marginBottom: '20px' }} />
        <Skeleton height="200px" style={{ marginBottom: '20px' }} />
        <Skeleton height="350px" />
      </div>
    )
  }

  return (
    <div className="career-page-container">
      {/* Header Banner */}
      <div className="career-header">
        <div>
          <h1 className="career-title">Career Profile & ATS Resume Builder</h1>
          <p className="career-subtitle">
            Manage your education, verified TechNeekX deliverables, portfolio projects, and generate an ATS-optimized PDF resume.
          </p>
        </div>
        <div className="career-header-actions">
          <Button
            variant="outline"
            onClick={copyShareLink}
            disabled={profile?.visibility === 'Private'}
          >
            📋 Copy Portfolio Link
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            {downloading ? 'Generating PDF...' : '📄 Download ATS Resume (PDF)'}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <Alert
          variant={statusMessage.type}
          onClose={() => setStatusMessage(null)}
          style={{ marginBottom: '1.25rem' }}
        >
          {statusMessage.text}
        </Alert>
      )}

      {/* Visibility & Profile Share Status Bar */}
      <Card className="career-visibility-card">
        <div className="visibility-bar">
          <div className="visibility-info">
            <span className="visibility-label">Portfolio Visibility:</span>
            <Badge
              variant={
                profile?.visibility === 'Public'
                  ? 'success'
                  : profile?.visibility === 'Community'
                  ? 'info'
                  : 'default'
              }
            >
              {profile?.visibility || 'Community'}
            </Badge>
            <span className="visibility-hint">
              {profile?.visibility === 'Public'
                ? 'Visible to anyone with your public link (recruiters & companies).'
                : profile?.visibility === 'Community'
                ? 'Visible to authenticated TechNeekX community members.'
                : 'Private: Only visible to you and verified TechNeekX leadership.'}
            </span>
          </div>
          <div className="visibility-controls">
            <select
              className="visibility-select"
              value={profileForm.visibility}
              onChange={(e) => {
                const val = e.target.value as any
                setProfileForm({ ...profileForm, visibility: val })
                careerApi.updateProfile({ visibility: val }).then((p) => {
                  setProfile(p)
                  setStatusMessage({ type: 'success', text: `Visibility changed to ${val}` })
                })
              }}
            >
              <option value="Community">Community Only</option>
              <option value="Public">Public (Anyone with link)</option>
              <option value="Private">Private</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="career-tabs">
        <button
          className={`career-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 Career & Education
        </button>
        <button
          className={`career-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          🚀 Projects & Awards ({profile?.projects.length || 0})
        </button>
        <button
          className={`career-tab-btn ${activeTab === 'contributions' ? 'active' : ''}`}
          onClick={() => setActiveTab('contributions')}
        >
          ⭐ Verified Contributions ({profile?.contributions.length || 0})
        </button>
        <button
          className={`career-tab-btn ${activeTab === 'resume' ? 'active' : ''}`}
          onClick={() => setActiveTab('resume')}
        >
          📑 ATS Resume Config
        </button>
      </div>

      {/* TAB 1: Profile & Education */}
      {activeTab === 'profile' && (
        <div className="career-tab-content">
          <form onSubmit={handleSaveProfile} className="career-profile-grid">
            <Card className="career-card">
              <CardHeader>
                <CardTitle>Career Targets & Identity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="form-row">
                  <Input
                    label="Headline"
                    value={profileForm.headline}
                    placeholder="e.g. Full-Stack Developer & Cloud Enthusiast"
                    onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}
                  />
                </div>
                <div className="form-row-2">
                  <Input
                    label="Target Job Role"
                    value={profileForm.target_role}
                    placeholder="e.g. SDE-1 / Frontend Engineer"
                    onChange={(e) => setProfileForm({ ...profileForm, target_role: e.target.value })}
                  />
                  <Input
                    label="Target Company / Domain"
                    value={profileForm.target_company}
                    placeholder="e.g. TechNeekX, Google, Startups"
                    onChange={(e) => setProfileForm({ ...profileForm, target_company: e.target.value })}
                  />
                </div>
                <div className="form-row-2">
                  <Input
                    label="Years of Experience"
                    type="number"
                    step="0.5"
                    value={profileForm.experience_years}
                    onChange={(e) => setProfileForm({ ...profileForm, experience_years: Number(e.target.value) })}
                  />
                  <Input
                    label="Location"
                    value={profileForm.location}
                    placeholder="e.g. Bengaluru, India"
                    onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <Input
                    label="Technical Skills (comma-separated)"
                    value={profileForm.skills}
                    placeholder="React, TypeScript, Python, Django, PostgreSQL, Docker"
                    onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <Textarea
                    label="Professional Bio / Summary"
                    rows={4}
                    value={profileForm.bio}
                    placeholder="Summarize your technical background, passions, and achievements..."
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="career-card">
              <CardHeader>
                <CardTitle>Contact & Social Profiles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="form-row-2">
                  <Input
                    label="Phone Number"
                    value={profileForm.phone}
                    placeholder="+91 9876543210"
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                  <Input
                    label="Email (Read Only)"
                    value={profile?.user_email || ''}
                    disabled
                  />
                </div>
                <div className="form-row">
                  <Input
                    label="LinkedIn Profile URL"
                    value={profileForm.linkedin_url}
                    placeholder="https://linkedin.com/in/yourprofile"
                    onChange={(e) => setProfileForm({ ...profileForm, linkedin_url: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <Input
                    label="GitHub Profile URL"
                    value={profileForm.github_url}
                    placeholder="https://github.com/yourusername"
                    onChange={(e) => setProfileForm({ ...profileForm, github_url: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <Input
                    label="Portfolio / Website URL"
                    value={profileForm.portfolio_url}
                    placeholder="https://yourportfolio.dev"
                    onChange={(e) => setProfileForm({ ...profileForm, portfolio_url: e.target.value })}
                  />
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving...' : '💾 Save Profile Details'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          {/* Education Records */}
          <Card className="career-card" style={{ marginTop: '1.5rem' }}>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Education & College Details</CardTitle>
              <Button variant="outline" onClick={() => setShowEduModal(true)}>
                + Add Education
              </Button>
            </CardHeader>
            <CardContent>
            {profile?.educations.length === 0 ? (
              <EmptyState
                title="No Education Records Added"
                description="Add your college, degree, graduation year, and CGPA to highlight your academic background."
              />
            ) : (
              <div className="edu-list">
                {profile?.educations.map((edu) => (
                  <div key={edu.id} className="edu-item">
                    <div className="edu-item-header">
                      <div>
                        <h4 className="edu-school">{edu.institution}</h4>
                        <div className="edu-degree">
                          {edu.degree} in {edu.field_of_study}
                        </div>
                      </div>
                      <div className="edu-meta">
                        <Badge variant="primary">Class of {edu.graduation_year}</Badge>
                        {edu.grade && <span className="edu-grade">{edu.grade}</span>}
                        <Button
                          variant="ghost"
                          style={{ color: 'var(--color-danger-text)', marginLeft: '0.5rem' }}
                          onClick={() => handleDeleteEducation(edu.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                    {edu.description && <p className="edu-desc">{edu.description}</p>}
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Projects & Achievements */}
      {activeTab === 'projects' && (
        <div className="career-tab-content">
          <Card className="career-card">
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Technical Project Portfolio</CardTitle>
              <Button variant="primary" onClick={() => setShowProjModal(true)}>
                + Add Project
              </Button>
            </CardHeader>
            <CardContent>
            {profile?.projects.length === 0 ? (
              <EmptyState
                title="No Projects in Portfolio"
                description="Showcase your best open-source and full-stack projects with live links and tech stack."
              />
            ) : (
              <div className="project-grid">
                {profile?.projects.map((proj) => (
                  <div key={proj.id} className="project-card">
                    <div className="project-card-header">
                      <h4 className="project-title">{proj.title}</h4>
                      <div className="project-badges">
                        {proj.is_featured && <Badge variant="warning">Featured</Badge>}
                        {proj.include_in_resume ? (
                          <Badge variant="success">In Resume</Badge>
                        ) : (
                          <Badge variant="default">Excluded</Badge>
                        )}
                        <Button
                          variant="ghost"
                          style={{ color: 'var(--color-danger-text)' }}
                          onClick={() => handleDeleteProject(proj.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                    <p className="project-desc">{proj.description}</p>
                    <div className="project-tech">
                      <strong>Stack:</strong> {proj.technologies}
                    </div>
                    <div className="project-links">
                      {proj.github_link && (
                        <a href={proj.github_link} target="_blank" rel="noopener noreferrer">
                          GitHub ↗
                        </a>
                      )}
                      {proj.live_url && (
                        <a href={proj.live_url} target="_blank" rel="noopener noreferrer">
                          Live Demo ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>

          <Card className="career-card" style={{ marginTop: '1.5rem' }}>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Achievements, Certifications & Awards</CardTitle>
              <Button variant="outline" onClick={() => setShowAchModal(true)}>
                + Add Award / Certification
              </Button>
            </CardHeader>
            <CardContent>
            {profile?.achievements.length === 0 ? (
              <EmptyState
                title="No Achievements Added"
                description="Add hackathons won, certifications earned, and official awards."
              />
            ) : (
              <div className="ach-list">
                {profile?.achievements.map((ach) => (
                  <div key={ach.id} className="ach-item">
                    <div>
                      <h4 className="ach-title">{ach.title}</h4>
                      <div className="ach-issuer">
                        Issued by <strong>{ach.issuer}</strong>
                        {ach.issue_date && ` • ${ach.issue_date}`}
                      </div>
                      {ach.description && <p className="ach-desc">{ach.description}</p>}
                      {ach.credential_url && (
                        <a href={ach.credential_url} target="_blank" rel="noopener noreferrer" className="ach-link">
                          Verify Credential ↗
                        </a>
                      )}
                    </div>
                    <div className="ach-actions">
                      {ach.include_in_resume ? (
                        <Badge variant="success">In Resume</Badge>
                      ) : (
                        <Badge variant="default">Excluded</Badge>
                      )}
                      <Button
                        variant="ghost"
                        style={{ color: 'var(--color-danger-text)', marginLeft: '0.5rem' }}
                        onClick={() => handleDeleteAchievement(ach.id)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: Verified TechNeekX Deliverables */}
      {activeTab === 'contributions' && (
        <div className="career-tab-content">
          <Card className="career-card">
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Verified TechNeekX Community Contributions</CardTitle>
              <Button variant="outline" onClick={handleSyncContributions} disabled={syncing}>
                {syncing ? 'Syncing...' : '🔄 Sync Approved Tasks'}
              </Button>
            </CardHeader>
            <CardContent>
              <Alert variant="info" style={{ marginBottom: '1rem' }}>
                <strong>Opt-In Guarantee:</strong> Verified community tasks are NEVER automatically forced into your professional resume.
                You explicitly toggle which deliverables appear on your public profile and ATS resume.
              </Alert>

              {profile?.contributions.length === 0 ? (
                <EmptyState
                  title="No Approved Deliverables Yet"
                  description="Complete assigned tasks and obtain official review approval to unlock verified community badges."
                />
              ) : (
                <div className="contrib-list">
                  {profile?.contributions.map((contrib) => (
                    <div key={contrib.id} className="contrib-item">
                      <div className="contrib-info">
                        <div className="contrib-title-row">
                          <h4 className="contrib-title">{contrib.title}</h4>
                          <Badge variant="success">+{contrib.points_earned} Points Verified</Badge>
                        </div>
                        <p className="contrib-desc">{contrib.description}</p>
                        <span className="contrib-date">
                          Verified on: {new Date(contrib.verified_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="contrib-toggle">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={contrib.include_in_resume}
                            onChange={() => handleToggleContribution(contrib.id)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <span className="toggle-label">
                          {contrib.include_in_resume ? 'Included on Resume' : 'Excluded'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: ATS Resume Builder & Config */}
      {activeTab === 'resume' && (
        <div className="career-tab-content">
          <Card className="career-card">
            <CardHeader>
              <CardTitle>ATS Resume Layout & Section Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="resume-config-info">
                Configure which sections are compiled into your downloadable ATS-friendly PDF.
                Our generator formats everything into clean, single-column, parseable structures tested for Applicant Tracking Systems.
              </p>

              <div className="form-row" style={{ marginTop: '1rem' }}>
                <Input
                  label="Custom Resume Headline (Overrides Profile Headline)"
                  value={resumeConfig.custom_headline || ''}
                  placeholder="e.g. Lead Software Engineer & Distributed Systems Developer"
                  onChange={(e) => setResumeConfig({ ...resumeConfig, custom_headline: e.target.value })}
                />
              </div>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--color-text-main)' }}>
                Resume Sections:
              </h4>
              <div className="resume-section-toggles">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resumeConfig.include_summary}
                    onChange={(e) => setResumeConfig({ ...resumeConfig, include_summary: e.target.checked })}
                  />
                  <span>Include Professional Summary / Bio</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resumeConfig.include_skills}
                    onChange={(e) => setResumeConfig({ ...resumeConfig, include_skills: e.target.checked })}
                  />
                  <span>Include Technical Skills & Core Competencies</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resumeConfig.include_education}
                    onChange={(e) => setResumeConfig({ ...resumeConfig, include_education: e.target.checked })}
                  />
                  <span>Include Education & College Credentials</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resumeConfig.include_projects}
                    onChange={(e) => setResumeConfig({ ...resumeConfig, include_projects: e.target.checked })}
                  />
                  <span>Include Selected Portfolio Projects</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resumeConfig.include_achievements}
                    onChange={(e) => setResumeConfig({ ...resumeConfig, include_achievements: e.target.checked })}
                  />
                  <span>Include Achievements, Certifications & Awards</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={resumeConfig.include_community_contributions}
                    onChange={(e) => setResumeConfig({ ...resumeConfig, include_community_contributions: e.target.checked })}
                  />
                  <span>Include Verified TechNeekX Deliverables (Explicitly Opted In)</span>
                </label>
              </div>

              <div className="resume-actions-row">
                <Button variant="outline" onClick={handleSaveResumeConfig}>
                  💾 Save Configuration
                </Button>
                <Button variant="primary" onClick={handleDownloadPdf} disabled={downloading}>
                  {downloading ? 'Compiling PDF...' : '⬇️ Download ATS Resume (PDF)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Add Education */}
      {showEduModal && (
        <Modal
          isOpen={showEduModal}
          onClose={() => setShowEduModal(false)}
          title="Add Education Record"
        >
          <form onSubmit={handleAddEducation}>
            <Input
              label="College / University Name *"
              required
              value={eduForm.institution}
              onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <Input
                label="Degree *"
                required
                placeholder="B.Tech, B.Sc, BCA"
                value={eduForm.degree}
                onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
              />
              <Input
                label="Field of Study *"
                required
                placeholder="Computer Science, IT"
                value={eduForm.field_of_study}
                onChange={(e) => setEduForm({ ...eduForm, field_of_study: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <Input
                label="Graduation Year *"
                type="number"
                required
                value={eduForm.graduation_year}
                onChange={(e) => setEduForm({ ...eduForm, graduation_year: Number(e.target.value) })}
              />
              <Input
                label="CGPA / Grade"
                placeholder="8.8 CGPA / 85%"
                value={eduForm.grade}
                onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Textarea
                label="Honors / Societies / Activities"
                rows={3}
                value={eduForm.description}
                onChange={(e) => setEduForm({ ...eduForm, description: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setShowEduModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Add Education
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Add Project */}
      {showProjModal && (
        <Modal
          isOpen={showProjModal}
          onClose={() => setShowProjModal(false)}
          title="Add Portfolio Project"
        >
          <form onSubmit={handleAddProject}>
            <Input
              label="Project Title *"
              required
              value={projForm.title}
              onChange={(e) => setProjForm({ ...projForm, title: e.target.value })}
            />
            <div style={{ marginTop: '1rem' }}>
              <Textarea
                label="Project Description *"
                required
                rows={3}
                placeholder="Describe what problem this project solves and architecture details..."
                value={projForm.description}
                onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Technologies Used *"
                required
                placeholder="e.g. React, Node.js, PostgreSQL, Docker"
                value={projForm.technologies}
                onChange={(e) => setProjForm({ ...projForm, technologies: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <Input
                label="GitHub Link"
                placeholder="https://github.com/..."
                value={projForm.github_link}
                onChange={(e) => setProjForm({ ...projForm, github_link: e.target.value })}
              />
              <Input
                label="Live Demo Link"
                placeholder="https://..."
                value={projForm.live_url}
                onChange={(e) => setProjForm({ ...projForm, live_url: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={projForm.is_featured}
                  onChange={(e) => setProjForm({ ...projForm, is_featured: e.target.checked })}
                />
                <span>Feature on Profile</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={projForm.include_in_resume}
                  onChange={(e) => setProjForm({ ...projForm, include_in_resume: e.target.checked })}
                />
                <span>Include in ATS Resume</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setShowProjModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Add Project
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Add Achievement */}
      {showAchModal && (
        <Modal
          isOpen={showAchModal}
          onClose={() => setShowAchModal(false)}
          title="Add Certification / Achievement"
        >
          <form onSubmit={handleAddAchievement}>
            <Input
              label="Achievement / Award Title *"
              required
              placeholder="e.g. AWS Certified Solutions Architect"
              value={achForm.title}
              onChange={(e) => setAchForm({ ...achForm, title: e.target.value })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <Input
                label="Issuing Authority *"
                required
                placeholder="e.g. Amazon Web Services"
                value={achForm.issuer}
                onChange={(e) => setAchForm({ ...achForm, issuer: e.target.value })}
              />
              <Input
                label="Issue Date"
                type="date"
                value={achForm.issue_date}
                onChange={(e) => setAchForm({ ...achForm, issue_date: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Input
                label="Credential Link / Verification URL"
                placeholder="https://..."
                value={achForm.credential_url}
                onChange={(e) => setAchForm({ ...achForm, credential_url: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Textarea
                label="Description"
                rows={2}
                value={achForm.description}
                onChange={(e) => setAchForm({ ...achForm, description: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={achForm.include_in_resume}
                  onChange={(e) => setAchForm({ ...achForm, include_in_resume: e.target.checked })}
                />
                <span>Include in ATS Resume</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button variant="outline" type="button" onClick={() => setShowAchModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Add Achievement
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
