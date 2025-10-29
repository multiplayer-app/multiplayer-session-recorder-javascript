import { IResourceAttributes } from '../types'
import { PACKAGE_VERSION_EXPORT } from '../config/constants'

export const getNavigatorInfo = (): IResourceAttributes => {
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

  const hardwareConcurrency = navigator.hardwareConcurrency || 1
  const cookiesEnabled = navigator.cookieEnabled ? 'Yes' : 'No'
  const pixelRatio = window.devicePixelRatio || 1
  const screenSize = `${window.screen.width}x${window.screen.height}`

  // Get package version from constants
  const packageVersion = PACKAGE_VERSION_EXPORT

  return {
    osInfo,
    screenSize,
    pixelRatio,
    deviceInfo,
    browserInfo,
    cookiesEnabled,
    hardwareConcurrency,
    packageVersion,
    // System type identifier (previously in system tags)
    systemType: 'web',
    // Platform identifier (previously in system tags)
    platform: osInfo,
  }
}