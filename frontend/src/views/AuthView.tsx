import React, { useState } from 'react'
import { ShieldCheck, Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DEMO_USERS } from '../types/api'
import { Button, Input, Alert, Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui'
import './AuthView.css'

export const AuthView: React.FC = () => {
  const { login, register, switchDemoUser, isLoading, error } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
      try {
        await register({ name, email, password })
        setSuccessMessage('Account registered successfully! Logging you in...')
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

  return (
    <div className="auth-container">
      <div className="auth-card-wrapper">
        {/* Brand header */}
        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <ShieldCheck size={28} />
          </div>
          <h1>TechNeekX</h1>
          <p className="auth-brand-tagline">Community Reporting & Task Management Platform</p>
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
                }}
              >
                Create Account
              </button>
            </div>
            <CardTitle>{mode === 'login' ? 'Welcome Back' : 'Join TechNeekX Community'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Sign in with your verified credentials or select a demo role below.'
                : 'New accounts are assigned the safe default Member role with full task submission access.'}
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
                title="Success"
                description={successMessage}
                className="auth-alert"
              />
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {mode === 'register' && (
                <Input
                  label="Full Name"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User size={18} />}
                  required
                />
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
                {mode === 'login' ? 'Sign In to Dashboard' : 'Register Member Account'}
              </Button>
            </form>

            {/* Quick Demo Switcher */}
            <div className="auth-demo-section">
              <div className="auth-divider">
                <span>or test with seeded demo accounts</span>
              </div>

              <div className="auth-demo-grid">
                {DEMO_USERS.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    className="auth-demo-tile"
                    disabled={isLoading}
                    onClick={() => handleQuickDemo(demo.email)}
                  >
                    <div className="auth-demo-tile-header">
                      <span className="auth-demo-name">{demo.label}</span>
                      <span className={`auth-demo-tier-tag tier-${demo.tier}`}>Tier {demo.tier}</span>
                    </div>
                    <span className="auth-demo-role">{demo.role}</span>
                    <span className="auth-demo-email">{demo.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="auth-footer-notes">
          <p>
            <CheckCircle2 size={14} className="auth-note-icon" />
            Backend JWT SimpleJWT enforced with role-based access control and tamper-proof scoring.
          </p>
        </div>
      </div>
    </div>
  )
}
