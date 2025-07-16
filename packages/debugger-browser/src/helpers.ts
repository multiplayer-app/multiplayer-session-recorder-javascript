import { DEBUG_SESSION_MAX_DURATION_SECONDS, PACKAGE_VERSION } from './constants'

export const getNavigatorInfo = () => {
  let browserInfo: string = 'Unknown'
  let deviceInfo: string = 'Unknown'
  let osInfo: string = 'Unknown'

  if (navigator.userAgent) {
    const userAgent = navigator.userAgent

    // Detect device type
    if (/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      deviceInfo = 'Mobile'
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceInfo = 'Tablet'
    } else {
      // Default to desktop for other cases
      deviceInfo = 'Desktop'
    }

    // Detect browser and version
    if (userAgent.includes('Firefox')) {
      browserInfo = `Mozilla Firefox ${userAgent.match(/Firefox\/(\d+\.\d+)/)?.[1] || ''}`
    } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browserInfo = `Google Chrome ${userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || ''}`
    } else if (userAgent.includes('Edg')) {
      browserInfo = `Microsoft Edge ${userAgent.match(/Edg\/(\d+\.\d+)/)?.[1] || ''}`
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browserInfo = `Safari ${userAgent.match(/Version\/(\d+\.\d+)/)?.[1] || ''}`
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browserInfo = `Opera ${userAgent.match(/(Opera|OPR)\/(\d+\.\d+)/)?.[2] || ''}`
    } else if (userAgent.includes('Trident')) {
      browserInfo = `Internet Explorer ${userAgent.match(/rv:(\d+\.\d+)/)?.[1] || ''}`
    } else {
      browserInfo = 'Unknown browser'
    }

    // Detect OS and version
    if (userAgent.includes('Win')) {
      osInfo = `Windows ${userAgent.match(/Windows NT (\d+\.\d+)/)?.[1] || ''}`
    } else if (userAgent.includes('Mac')) {
      osInfo = `MacOS ${userAgent.match(/Mac OS X (\d+_\d+)/)?.[1].replace('_', '.') || ''}`
    } else if (userAgent.includes('Linux')) {
      osInfo = 'Linux'
    } else if (userAgent.includes('Android')) {
      osInfo = `Android ${userAgent.match(/Android (\d+\.\d+)/)?.[1] || ''}`
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      osInfo = `iOS ${userAgent.match(/OS (\d+_\d+)/)?.[1].replace('_', '.') || ''}`
    } else {
      osInfo = 'Unknown OS'
    }
  }

  const hardwareConcurrency = navigator.hardwareConcurrency || 'Unknown'
  const cookiesEnabled = navigator.cookieEnabled ? 'Yes' : 'No'
  const pixelRatio = window.devicePixelRatio || 'Unknown'
  const screenSize = `${window.screen.width}x${window.screen.height}`

  // Get package version from constants
  const packageVersion = PACKAGE_VERSION

  return {
    osInfo,
    screenSize,
    pixelRatio,
    deviceInfo,
    browserInfo,
    cookiesEnabled,
    hardwareConcurrency,
    packageVersion,
  }
}

export const getFormattedDate = (date, options?) => {
  return new Date(date).toLocaleDateString(
    'en-US',
    options || {
      month: 'short',
      year: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    },
  )
}

export const getStoredItem = (key: string, parse?: boolean): any => {
  const item = localStorage?.getItem(key)
  return parse ? (item ? JSON.parse(item) : null) : item
}

export const setStoredItem = (key: string, value: any) => {
  if (value === null || value === undefined) {
    localStorage?.removeItem(key)
  } else {
    localStorage?.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}

export const removeStoredItem = (key: string) => {
  localStorage?.removeItem(key)
}

export const formatTimeForSessionTimer = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const getTimeDifferenceInSeconds = (startedAt: any) => {
  if (!startedAt) {
    return 0
  }

  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
}

export const isSessionActive = (session, continuousDebugging: boolean) => {
  if (!session) return false
  if (continuousDebugging) return true
  const startedAt = new Date(session.startedAt)
  const now = new Date()
  const diff = now.getTime() - startedAt.getTime()
  return diff < DEBUG_SESSION_MAX_DURATION_SECONDS * 1000
}