import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { login as apiLogin, logout as apiLogout, signup as apiSignup } from '../api/authApi.js'
import { request } from '../api/client.js'

const AuthContext = createContext(null)

const STORAGE_KEY = 'ai_lotto_user'

function loadUserFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // ignore parse errors
  }
  return null
}

function saveUserToStorage(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadUserFromStorage())
  const [authLoading, setAuthLoading] = useState(true)

  const signup = async ({ identifier, password, consentTerms, consentMarketing, sms_verified_token }) => {
    try {
      const response = await apiSignup({ identifier, password, consentTerms, consentMarketing, sms_verified_token })
      const nextUser = {
        id: response.user_id,
        identifier: response.identifier || identifier,
        isAdmin: response.is_admin || false,
        tier: response.tier || 'FREE',
        first_week_bonus_used: response.first_week_bonus_used || false,
        weekly_free_used_at: response.weekly_free_used_at || null,
        signup_at: response.signup_at || new Date().toISOString(),
      }
      setUser(nextUser)
      saveUserToStorage(nextUser)
      return { ok: true }
    } catch {
      return { ok: false, message: '회원가입에 실패했습니다.' }
    }
  }

  // 외부에서 user 상태 직접 설정 (OTP 간편가입 등)
  const setUserData = (userData) => {
    if (userData) {
      const nextUser = {
        id: userData.user_id || userData.id,
        identifier: userData.identifier || userData.phone,
        isAdmin: userData.is_admin || false,
        tier: userData.tier || 'FREE',
        first_week_bonus_used: userData.first_week_bonus_used || false,
        weekly_free_used_at: userData.weekly_free_used_at || null,
        signup_at: userData.signup_at || new Date().toISOString(),
      }
      setUser(nextUser)
      saveUserToStorage(nextUser)
    } else {
      setUser(null)
      saveUserToStorage(null)
    }
  }

  const login = async ({ identifier, password }) => {
    try {
      const response = await apiLogin({ identifier, password })
      const nextUser = {
        id: response.user_id,
        identifier: response.identifier || identifier,
        isAdmin: response.is_admin || false,
        tier: response.tier || 'FREE',
        first_week_bonus_used: response.first_week_bonus_used || false,
        weekly_free_used_at: response.weekly_free_used_at || null,
        signup_at: response.signup_at || null,
      }
      setUser(nextUser)
      saveUserToStorage(nextUser)
      return { ok: true }
    } catch {
      return { ok: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' }
    }
  }

  const logout = async () => {
    try {
      await apiLogout()
    } catch {
      // ignore logout errors to avoid blocking local cleanup
    }
    setUser(null)
    saveUserToStorage(null)
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      // 로컬 스토리지에 저장된 사용자가 있으면 서버에 확인
      const storedUser = loadUserFromStorage()
      if (storedUser) {
        try {
          const data = await request('/api/auth/me')
          if (!active) return
          const verifiedUser = {
            id: data.user_id,
            identifier: data.identifier,
            name: data.name || null,
            phone_number: data.phone_number || null,
            isAdmin: data.is_admin || false,
            tier: data.tier || 'FREE',
            first_week_bonus_used: data.first_week_bonus_used || false,
            weekly_free_used_at: data.weekly_free_used_at || null,
            created_at: data.created_at || null,
          }
          setUser(verifiedUser)
          saveUserToStorage(verifiedUser)
        } catch {
          // 서버 검증 실패해도 로컬 스토리지 사용자 유지 (오프라인 지원)
          if (!active) return
          setUser(storedUser)
        }
      } else {
        // 로컬 스토리지에 없으면 서버에서 확인 시도
        try {
          const data = await request('/api/auth/me')
          if (!active) return
          const verifiedUser = {
            id: data.user_id,
            identifier: data.identifier,
            name: data.name || null,
            phone_number: data.phone_number || null,
            isAdmin: data.is_admin || false,
            tier: data.tier || 'FREE',
            first_week_bonus_used: data.first_week_bonus_used || false,
            weekly_free_used_at: data.weekly_free_used_at || null,
            created_at: data.created_at || null,
          }
          setUser(verifiedUser)
          saveUserToStorage(verifiedUser)
        } catch {
          if (!active) return
          setUser(null)
        }
      }
      if (active) setAuthLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthed: Boolean(user),
      isAdmin: user?.isAdmin || false,
      authLoading,
      isLoading: authLoading, // alias for backward compatibility
      signup,
      login,
      logout,
      setUser: setUserData,
    }),
    [user, authLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
