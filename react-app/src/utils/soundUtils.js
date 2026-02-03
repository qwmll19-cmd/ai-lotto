/**
 * 사운드 효과 유틸리티
 * - 모바일 무음/진동 모드에서는 브라우저가 자동으로 음소거 처리
 * - localStorage를 통해 유저별 설정 저장
 */

// localStorage 키 prefix
const SOUND_ENABLED_KEY_PREFIX = 'ai-lotto-sound-enabled'

// 사운드 파일 경로
const SOUNDS = {
  click: '/sounds/click.mp3',
  success: '/sounds/success.mp3',
  drumroll: '/sounds/drumroll.mp3',
}

// 캐시된 오디오 객체
const audioCache = {}

// 현재 유저 ID (setCurrentUser로 설정)
let currentUserId = null

/**
 * 현재 유저 설정 (로그인 시 호출)
 * @param {string | null} userId
 */
export const setCurrentUser = (userId) => {
  currentUserId = userId
}

/**
 * 현재 유저의 localStorage 키 생성
 * @returns {string}
 */
const getStorageKey = () => {
  if (currentUserId) {
    return `${SOUND_ENABLED_KEY_PREFIX}-${currentUserId}`
  }
  // 로그인 안한 경우 기본 키 사용
  return SOUND_ENABLED_KEY_PREFIX
}

/**
 * 사운드 설정 상태 가져오기
 * @returns {boolean}
 */
export const isSoundEnabled = () => {
  try {
    const stored = localStorage.getItem(getStorageKey())
    // 저장된 값이 없으면 기본값 true (활성화)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

/**
 * 사운드 설정 변경
 * @param {boolean} enabled
 */
export const setSoundEnabled = (enabled) => {
  try {
    localStorage.setItem(getStorageKey(), String(enabled))
    // 사운드 끄면 재생 중인 모든 사운드 정지
    if (!enabled) {
      stopAllSounds()
    }
  } catch {
    // localStorage 접근 실패 시 무시
  }
}

/**
 * 사운드 재생 (한 번)
 * @param {'click' | 'success' | 'drumroll'} soundName
 * @param {number} volume - 볼륨 (0.0 ~ 1.0)
 */
export const playSound = (soundName, volume = 0.5) => {
  // 사운드가 꺼져있으면 재생하지 않음
  if (!isSoundEnabled()) return

  try {
    const soundPath = SOUNDS[soundName]
    if (!soundPath) return

    // 새 오디오 객체 생성 (중복 재생 허용)
    const audio = new Audio(soundPath)
    audio.volume = volume
    audio.play().catch(() => {
      // 자동 재생 정책으로 인한 에러 무시 (사용자 인터랙션 필요)
    })
  } catch {
    // 오디오 재생 실패 시 무시
  }
}

// 드럼롤 최소 재생 시간 (ms)
let drumrollStartTime = null

/**
 * 루프 사운드 시작 (드럼롤용)
 * @param {'drumroll'} soundName
 * @param {number} volume
 * @param {number} startAt - 시작 위치 (초), 기본 2초부터 (클라이맥스 부분)
 * @returns {Audio | null} - 정지할 때 사용할 오디오 객체
 */
export const startLoopSound = (soundName, volume = 0.4, startAt = 2) => {
  // 사운드가 꺼져있으면 재생하지 않음
  if (!isSoundEnabled()) return null

  try {
    const soundPath = SOUNDS[soundName]
    if (!soundPath) return null

    // 기존 캐시된 오디오가 있으면 정지
    if (audioCache[soundName]) {
      audioCache[soundName].pause()
      audioCache[soundName].currentTime = 0
    }

    const audio = new Audio(soundPath)
    audio.volume = volume
    audio.loop = true
    audio.currentTime = startAt // 중간부터 시작
    audio.play().catch(() => {
      // 자동 재생 정책으로 인한 에러 무시
    })

    audioCache[soundName] = audio
    drumrollStartTime = Date.now() // 시작 시간 기록
    return audio
  } catch {
    return null
  }
}

/**
 * 루프 사운드 정지 (최소 재생 시간 보장)
 * @param {'drumroll'} soundName
 * @param {number} minDuration - 최소 재생 시간 (ms), 기본 1.5초
 * @returns {Promise<void>}
 */
export const stopLoopSoundWithDelay = async (soundName, minDuration = 1500) => {
  const elapsed = drumrollStartTime ? Date.now() - drumrollStartTime : minDuration
  const remaining = Math.max(0, minDuration - elapsed)

  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining))
  }

  stopLoopSound(soundName)
  drumrollStartTime = null
}

/**
 * 루프 사운드 정지
 * @param {'drumroll'} soundName
 */
export const stopLoopSound = (soundName) => {
  try {
    const audio = audioCache[soundName]
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      delete audioCache[soundName]
    }
  } catch {
    // 정지 실패 시 무시
  }
}

/**
 * 모든 사운드 정지
 */
export const stopAllSounds = () => {
  Object.keys(audioCache).forEach((key) => {
    try {
      audioCache[key].pause()
      audioCache[key].currentTime = 0
      delete audioCache[key]
    } catch {
      // 무시
    }
  })
}
