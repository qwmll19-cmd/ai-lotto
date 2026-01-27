/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { login as apiLogin, logout as apiLogout, signup as apiSignup } from '../api/authApi.js'
import { request, saveTokens, getAccessToken } from '../api/client.js'

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

  const signup = async ({ name, identifier, password, phone, sms_verified_token }) => {
    try {
      const response = await apiSignup({ name, identifier, password, phone, sms_verified_token })

      // Token 기반 인증: 토큰 저장
      if (response.access_token && response.refresh_token) {
        saveTokens({
          access_token: response.access_token,
          refresh_token: response.refresh_token,
        })
      }

      // user 정보는 response.user에서 가져옴 (새로운 응답 형식)
      const userData = response.user || response
      const nextUser = {
        id: userData.user_id || response.user_id,
        name: userData.name || name,
        identifier: userData.identifier || identifier,
        isAdmin: userData.is_admin || false,
        tier: userData.tier || 'FREE',
        first_week_bonus_used: userData.first_week_bonus_used || false,
        weekly_free_used_at: userData.weekly_free_used_at || null,
        signup_at: userData.created_at || new Date().toISOString(),
      }
      setUser(nextUser)
      saveUserToStorage(nextUser)
      return { ok: true }
    } catch (err) {
      // 서버에서 반환한 에러 메시지 전달
      return { ok: false, message: err?.message || '회원가입에 실패했습니다.' }
    }
  }

  // 외부에서 user 상태 직접 설정 (OTP 간편가입, 소셜 로그인 등)
  const setUserData = (userData) => {
    if (userData) {
      const nextUser = {
        id: userData.user_id || userData.id,
        identifier: userData.identifier || userData.phone,
        name: userData.name || null,
        nickname: userData.nickname || null,
        phone_number: userData.phone_number || null,
        isAdmin: userData.is_admin || false,
        tier: userData.tier || 'FREE',
        first_week_bonus_used: userData.first_week_bonus_used || false,
        weekly_free_used_at: userData.weekly_free_used_at || null,
        created_at: userData.created_at || userData.signup_at || null,
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

      // Token 기반 인증: 토큰 저장
      if (response.access_token && response.refresh_token) {
        saveTokens({
          access_token: response.access_token,
          refresh_token: response.refresh_token,
        })
      }

      // user 정보는 response.user에서 가져옴 (새로운 응답 형식)
      const userData = response.user || response
      const nextUser = {
        id: userData.user_id || response.user_id,
        identifier: userData.identifier || identifier,
        name: userData.name || null,
        nickname: userData.nickname || null,
        phone_number: userData.phone_number || null,
        isAdmin: userData.is_admin || false,
        tier: userData.tier || 'FREE',
        first_week_bonus_used: userData.first_week_bonus_used || false,
        weekly_free_used_at: userData.weekly_free_used_at || null,
        created_at: userData.created_at || null,
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
    // Token 기반 인증: 토큰 삭제
    saveTokens(null)
    setUser(null)
    saveUserToStorage(null)
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      // Token 기반 인증: 토큰 존재 여부 먼저 확인
      const accessToken = getAccessToken()
      const storedUser = loadUserFromStorage()

      // 토큰이 있거나 저장된 사용자가 있으면 서버에 확인
      if (accessToken || storedUser) {
        try {
          const data = await request('/api/auth/me')
          if (!active) return
          const verifiedUser = {
            id: data.user_id,
            identifier: data.identifier,
            name: data.name || null,
            nickname: data.nickname || null,
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
          // 토큰이 유효하지 않으면 삭제
          saveTokens(null)
          setUser(null)
          saveUserToStorage(null)
        }
      } else {
        // 토큰과 저장된 사용자 모두 없음 - 비로그인 상태
        setUser(null)
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
