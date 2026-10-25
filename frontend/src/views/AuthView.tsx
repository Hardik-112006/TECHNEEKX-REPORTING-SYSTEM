import React, { useState, useEffect, useCallback } from 'react'
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'
import type { DemoAccount } from '../types/api'
import {
  Button,
  Input,
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '../components/ui'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import './AuthView.css'

export interface PublicGroup {
  group_id: number
  name: string
  team_id: number
  team_name: string | null
  description?: string
}

const REGISTRATION_CATEGORIES = [
  { value: 'Member', label: 'Members' },
  { value: 'Official', label: 'Officials' },
  { value: 'Director', label: 'Director of Core Operations' },
  { value: 'Core', label: 'Core Leads' },
  { value: 'Founder', label: 'Founder' }
] as const

const OFFICIAL_POSITIONS = [
  'Chairman',
  'President',
  'Managing Director',
  'Chief Technical Officer'
] as const

export const AuthView: React.FC = () => {
  const { login, register, switchDemoUser, isLoading, error } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  
  // Registration Category Logic
  const [category, setCategory] = useState<'Member' | 'Official' | 'Core' | 'Director' | 'Founder'>('Member')
  const [availableGroups, setAvailableGroups] = useState<PublicGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [officialPosition, setOfficialPosition] = useState<string>('Chairman')
  const [coreLeadGroupId, setCoreLeadGroupId] = useState<string>('')
  const [authKey, setAuthKey] = useState<string>('')

  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Dynamic demo accounts loaded directly from database seeded users
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([])
  const [isLoadingDemos, setIsLoadingDemos] = useState<boolean>(true)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [showAllDemos, setShowAllDemos] = useState<boolean>(false)

  const fetchDemoAccounts = useCallback(async () => {
    setIsLoadingDemos(true)
    setDemoError(null)
    try {
      const data = await authApi.getDemoAccounts()
      setDemoAccounts(data)
    } catch (err: any) {
      setDemoError(err?.message || 'Failed to load demo accounts from database.')
      setDemoAccounts([])
    } finally {
      setIsLoadingDemos(false)
    }
  }, [])

  useEffect(() => {
    fetchDemoAccounts()
  }, [fetchDemoAccounts])

  // Load available active groups dynamically from backend
  useEffect(() => {
    let isMounted = true
    authApi.getPublicGroups().then((groups) => {
      if (isMounted) {
        setAvailableGroups(groups)
        if (groups.length > 0) {
          setSelectedGroupId(String(groups[0].group_id))
          setCoreLeadGroupId(String(groups[0].group_id))
        }
      }
    }).catch(() => {
      if (isMounted) {
        const fallback: PublicGroup[] = [
          { group_id: 1, name: 'Frontend & UI Engineering', team_id: 1, team_name: 'Engineering Core' },
          { group_id: 2, name: 'Backend & Cloud Architecture', team_id: 1, team_name: 'Engineering Core' },
          { group_id: 3, name: 'AI & Machine Learning Research', team_id: 2, team_name: 'Emerging Tech & Innovation' }
        ]
        setAvailableGroups(fallback)
        setSelectedGroupId('1')
        setCoreLeadGroupId('1')
      }
    })
    return () => { isMounted = false }
  }, [])

  const handleCategoryChange = (newCat: 'Member' | 'Official' | 'Core' | 'Director' | 'Founder') => {
    setCategory(newCat)
    setLocalError(null)
    setAuthKey('')
    // Reset dependent selection when parent category changes
    if (newCat === 'Member') {
      setSelectedGroupId(availableGroups[0] ? String(availableGroups[0].group_id) : '')
    } else if (newCat === 'Official') {
      setOfficialPosition(OFFICIAL_POSITIONS[0])
    } else if (newCat === 'Core') {
      setCoreLeadGroupId(availableGroups[0] ? String(availableGroups[0].group_id) : '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setSuccessMessage(null)

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setLocalError('Please enter both email and password.')
        return
      }
      try {
        await login({ email, password })
      } catch (err: any) {
        setLocalError(err.message || 'Login failed')
      }
    } else {
      if (!name.trim() || !email.trim() || !password) {
        setLocalError('Please provide your name, email, and password.')
        return
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.')
        return
      }

      // Role-dependent field validation
      if (category === 'Member') {
        if (!selectedGroupId) {
          setLocalError('Please select a group for your Member registration.')
          return
        }
      } else if (category === 'Official') {
        if (!officialPosition) {
          setLocalError('Please select an Official position.')
          return
        }
      } else if (category === 'Core') {
        if (!coreLeadGroupId) {
          setLocalError('Please select an available Core Lead position associated with a group.')
          return
        }
      } else if (category === 'Founder') {
        if (!authKey.trim()) {
          setLocalError('The Founder role requires the Founder Master Authorization Key.')
          return
        }
      }

      try {
        let payload: any = {
          name: name.trim(),
          email: email.trim(),
          password,
          category,
          auth_key: authKey.trim() || undefined
        }

        if (category === 'Member') {
          payload.group_id = Number(selectedGroupId)
          payload.requested_role = 'Member'
        } else if (category === 'Official') {
          payload.position = officialPosition
          payload.requested_role = officialPosition
        } else if (category === 'Core') {
          const matchedGroup = availableGroups.find((g) => String(g.group_id) === String(coreLeadGroupId))
          const leadTitle = matchedGroup?.name.includes('Frontend')
            ? 'Frontend Lead'
            : matchedGroup?.name.includes('Backend')
            ? 'Backend Lead'
            : `${matchedGroup?.name || 'Group'} Lead`
          payload.position = leadTitle
          payload.group_id = Number(coreLeadGroupId)
          payload.requested_role = 'Core Team Lead'
        } else if (category === 'Director') {
          payload.position = 'Director of Operations'
          payload.requested_role = 'Director of Core Operations'
        } else if (category === 'Founder') {
          payload.position = 'Founder'
          payload.requested_role = 'Founder'
        }

        const res = await register(payload)
        if (res.requiresApproval) {
          setSuccessMessage(res.message)
          setMode('login')
        }
      } catch (err: any) {
        setLocalError(err.message || 'Registration failed')
      }
    }
  }

  const handleQuickDemo = async (demoEmail: string) => {
    setLocalError(null)
    setSuccessMessage(null)
    try {
      await switchDemoUser(demoEmail)
    } catch (err: any) {
      setLocalError(err.message || 'Failed to authenticate demo user')
    }
  }

  const isPrivileged = category !== 'Member'

  return (
    <div className="auth-container">
      {/* Top Bar with Brand & Persistent Theme Toggle */}
      <header className="auth-top-header">
        <div className="auth-top-brand">
          <img src="/tnxlogo.jpg" alt="TechNeekX Logo" className="auth-top-logo" />
          <span className="auth-top-title">TechNeekX</span>
          <span className="auth-top-pill">Reporting System</span>
        </div>
        <div className="auth-top-actions">
          <ThemeToggle />
        </div>
      </header>

      <div className="auth-card-wrapper">
        {/* Brand header */}
        <div className="auth-brand-header">
          <div className="auth-brand-logo-frame">
            <img src="/tnxlogo.jpg" alt="TechNeekX" className="auth-brand-logo" />
          </div>
          <h1 className="auth-brand-heading">TechNeekX</h1>
          <p className="auth-brand-tagline">
            Official 5-Role Task Reporting & Compliance Platform
          </p>
        </div>

        <Card className="auth-card">
          <CardHeader>
            <div className="auth-tab-group">
              <button
                type="button"
                className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setMode('login')
                  setLocalError(null)
                  setSuccessMessage(null)
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setMode('register')
                  setLocalError(null)
                  setSuccessMessage(null)
                }}
              >
                Create Account
              </button>
            </div>
            <CardTitle>{mode === 'login' ? 'Sign In to Your Workspace' : 'Register for TechNeekX'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Sign in with your verified credentials or choose an official role demo account.'
                : 'Select your organizational category and submit for verification or instant member onboarding.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {(localError || error) && (
              <Alert
                variant="danger"
                title="Authentication Error"
                description={localError || error || undefined}
                className="auth-alert"
              />
            )}

            {successMessage && (
              <Alert
                variant="success"
                title="Registration Submitted"
                description={successMessage}
                className="auth-alert"
              />
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {mode === 'register' && (
                <>
                  <Input
                    label="Full Name"
                    placeholder="e.g. Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    leftIcon={<User size={18} />}
                    required
                  />

                  {/* Dynamic Category & Dependent Dropdown */}
                  <div className="auth-form-row">
                    <div className="auth-form-group">
                      <label className="auth-form-label">Category *</label>
                      <select
                        className="auth-form-select"
                        value={category}
                        onChange={(e) => handleCategoryChange(e.target.value as 'Member' | 'Official' | 'Core' | 'Director' | 'Founder')}
                        aria-label="Registration Category"
                      >
                        {REGISTRATION_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="auth-form-group">
                      {category === 'Member' && (
                        <>
                          <label className="auth-form-label">Select Group *</label>
                          <select
                            className="auth-form-select"
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            aria-label="Select Group"
                            required
                          >
                            <option value="">-- Choose Group --</option>
                            {availableGroups.map((g) => (
                              <option key={g.group_id} value={String(g.group_id)}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      {category === 'Official' && (
                        <>
                          <label className="auth-form-label">Official Position *</label>
                          <select
                            className="auth-form-select"
                            value={officialPosition}
                            onChange={(e) => setOfficialPosition(e.target.value)}
                            aria-label="Select Official Position"
                            required
                          >
                            <option value="">-- Choose Official Position --</option>
                            {OFFICIAL_POSITIONS.map((pos) => (
                              <option key={pos} value={pos}>
                                {pos}
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      {category === 'Core' && (
                        <>
                          <label className="auth-form-label">Core Lead Position *</label>
                          <select
                            className="auth-form-select"
                            value={coreLeadGroupId}
                            onChange={(e) => setCoreLeadGroupId(e.target.value)}
                            aria-label="Select Core Lead Position"
                            required
                          >
                            <option value="">-- Choose Core Lead Position --</option>
                            {availableGroups.map((g) => {
                              const shortTitle = g.name.includes('Frontend')
                                ? 'Frontend Lead'
                                : g.name.includes('Backend')
                                ? 'Backend Lead'
                                : `${g.name} Lead`
                              return (
                                <option key={g.group_id} value={String(g.group_id)}>
                                  {shortTitle} ({g.name})
                                </option>
                              )
                            })}
                          </select>
                        </>
                      )}

                      {category === 'Director' && (
                        <>
                          <label className="auth-form-label">Admin Auth Key (Optional)</label>
                          <input
                            type="password"
                            className="auth-form-input"
                            value={authKey}
                            onChange={(e) => setAuthKey(e.target.value)}
                            placeholder="Key for immediate activation"
                            aria-label="Director Authorization Key"
                          />
                        </>
                      )}

                      {category === 'Founder' && (
                        <>
                          <label className="auth-form-label">Founder Master Key *</label>
                          <input
                            type="password"
                            className="auth-form-input"
                            value={authKey}
                            onChange={(e) => setAuthKey(e.target.value)}
                            placeholder="Master setup key"
                            aria-label="Founder Master Authorization Key"
                            required
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Security Safeguard Notice tailored to all 5 roles */}
                  {category === 'Founder' ? (
                    <div className="auth-safeguard-box warning">
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>Founder Tier-1 Governance:</strong> The Founder possesses full executive authority and system oversight. Initial registration strictly requires the Master Setup Key. Arbitrary public registration is forbidden.
                      </span>
                    </div>
                  ) : category === 'Director' ? (
                    <div className="auth-safeguard-box warning">
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>Operations Safeguard:</strong> Director of Core Operations oversees cross-functional core teams. Submit with an authorization key for instant activation, or leave blank to submit for Pending administrative review.
                      </span>
                    </div>
                  ) : category === 'Official' ? (
                    <div className="auth-safeguard-box warning">
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>Governance Safeguard:</strong> Officials ({officialPosition || 'Chairman, President, MD, CTO'}) possess executive oversight. Your account will be submitted in <em>Pending</em> status requiring administrative confirmation before login.
                      </span>
                    </div>
                  ) : category === 'Core' ? (
                    <div className="auth-safeguard-box warning">
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>Leadership Safeguard:</strong> Core Leads manage group tasks and submissions. Your account will be submitted in <em>Pending</em> status requiring leadership confirmation before login.
                      </span>
                    </div>
                  ) : (
                    <div className="auth-safeguard-box info">
                      <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>Instant Access:</strong> TechNeekX community members receive immediate dashboard access to their selected group tasks, deadlines, and submissions.
                      </span>
                    </div>
                  )}
                </>
              )}

              <Input
                type="email"
                label="Email Address"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={18} />}
                required
              />

              <Input
                type="password"
                label="Password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock size={18} />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={18} />}
                className="auth-submit-btn"
              >
                {mode === 'login'
                  ? 'Sign In to Dashboard'
                  : category === 'Founder'
                  ? 'Initialize Founder Account'
                  : category === 'Director' && authKey
                  ? 'Activate Director Account'
                  : isPrivileged
                  ? 'Submit for Approval'
                  : 'Register Member Account'}
              </Button>
            </form>

            {/* Quick Demo Switcher - Dynamically Loaded from Database Seed */}
            {mode === 'login' && (
              <div className="auth-demo-section">
                <div className="auth-divider">
                  <span>or sign in with dynamic demo accounts</span>
                </div>

                {isLoadingDemos ? (
                  <div className="auth-demo-state-box loading" role="status" aria-live="polite">
                    <Loader2 className="auth-demo-spinner" size={20} />
                    <span>Loading available demo accounts from database...</span>
                  </div>
                ) : demoError ? (
                  <div className="auth-demo-state-box error" role="alert">
                    <div className="auth-demo-error-info">
                      <AlertTriangle size={18} className="auth-demo-error-icon" />
                      <span>{demoError}</span>
                    </div>
                    <button
                      type="button"
                      className="auth-demo-retry-btn"
                      onClick={fetchDemoAccounts}
                    >
                      <RefreshCw size={13} />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : demoAccounts.length === 0 ? (
                  <div className="auth-demo-state-box empty">
                    <Info size={18} />
                    <span>No demo accounts currently available in the database.</span>
                  </div>
                ) : (
                  <>
                    <div className="auth-demo-grid">
                      {(showAllDemos ? demoAccounts : demoAccounts.slice(0, 6)).map((demo) => (
                        <button
                          key={demo.email}
                          type="button"
                          className="auth-demo-tile"
                          disabled={isLoading}
                          onClick={() => handleQuickDemo(demo.email)}
                          title={`Click to authenticate as ${demo.name} (${demo.role})`}
                        >
                          <div className="auth-demo-tile-header">
                            <span className="auth-demo-name">{demo.label || demo.name}</span>
                            <span className={`auth-demo-tier-tag tier-${demo.tier}`}>
                              Tier {demo.tier}
                            </span>
                          </div>
                          <div className="auth-demo-meta-row">
                            <span className="auth-demo-role">{demo.role}</span>
                            {demo.group_name && (
                              <span className="auth-demo-group-badge">{demo.group_name}</span>
                            )}
                          </div>
                          <span className="auth-demo-email">{demo.email}</span>
                        </button>
                      ))}
                    </div>

                    {demoAccounts.length > 6 && (
                      <div className="auth-demo-toggle-row">
                        <button
                          type="button"
                          className="auth-demo-toggle-btn"
                          onClick={() => setShowAllDemos(!showAllDemos)}
                        >
                          {showAllDemos ? (
                            <>
                              <ChevronUp size={14} />
                              <span>Show Fewer Demo Accounts</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} />
                              <span>Show All Demo Accounts ({demoAccounts.length})</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="auth-footer-notes">
          <p>
            <CheckCircle2 size={14} className="auth-note-icon" />
            Backend JWT SimpleJWT enforced with 5 canonical TechNeekX roles and SQLite persistent storage.
          </p>
        </div>
      </div>
    </div>
  )
}
