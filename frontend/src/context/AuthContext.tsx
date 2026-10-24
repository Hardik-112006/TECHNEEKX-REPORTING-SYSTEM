import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { UserDetail } from '../types/api'
import { authApi, getStoredAccessToken, clearTokens } from '../services/api'

interface AuthContextType {
  user: UserDetail | null
  roleTier: number
  roleName: string
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (credentials: { email: string; password: string }) => Promise<void>
  register: (data: { name: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  switchDemoUser: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refreshUser = useCallback(async () => {
    try {
      const token = getStoredAccessToken()
      if (!token) {
        setUser(null)
        setIsLoading(false)
        return
      }
      const userData = await authApi.getMe()
      setUser(userData)
      setError(null)
    } catch {
      setUser(null)
      clearTokens()
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()

    const handleAuthExpired = () => {
      setUser(null)
      setError('Session expired. Please log in again.')
    }

    window.addEventListener('auth:expired', handleAuthExpired)
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired)
    }
  }, [refreshUser])

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await authApi.login(credentials)
      setUser(response.user)
    } catch (err: any) {
      setError(err?.message || 'Login failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (data: { name: string; email: string; password: string }) => {
    setIsLoading(true)
    setError(null)
    try {
      await authApi.register(data)
      // Auto-login after registration
      await login({ email: data.email, password: data.password })
    } catch (err: any) {
      setError(err?.message || 'Registration failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setIsLoading(false)
    }
  }

  const switchDemoUser = async (email: string) => {
    // Known seeded demo password
    await login({ email, password: 'Techneekx@2026' })
  }

  const roleTier = user?.role_tier ?? 5
  const roleName = user?.role?.name || user?.role_name || 'Member'

  return (
    <AuthContext.Provider
      value={{
        user,
        roleTier,
        roleName,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser,
        switchDemoUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
