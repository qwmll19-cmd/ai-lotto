import { request } from './client.js'

export function login(payload) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function signup({ identifier, password, phone, sms_verified_token }) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      identifier,
      password,
      phone,
      sms_verified_token,
    }),
  })
}

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
  })
}

export function sendSmsCode(phone) {
  return request('/api/auth/send-sms-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export function verifySmsCode(phone, code) {
  return request('/api/auth/verify-sms-code', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}

export function verifyResetToken(token) {
  return request(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
}

export function resetPassword(resetToken, newPassword) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
  })
}

// OTP 인증번호 발송 (간편 가입용)
export function sendOtp(phone) {
  return request('/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

// OTP 검증 + 간편 가입
export function verifyOtpSignup({ phone, code, consentTerms, consentMarketing }) {
  return request('/api/auth/verify-otp-signup', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      code,
      consent_terms: consentTerms,
      consent_marketing: consentMarketing,
    }),
  })
}

// 플랜 업데이트 (결제 완료 시)
export function updateUserPlan(planType, paymentMethod = 'card', durationDays = 30) {
  return request('/api/auth/update-plan', {
    method: 'POST',
    body: JSON.stringify({
      plan_type: planType,
      payment_method: paymentMethod,
      duration_days: durationDays,
    }),
  })
}
