
/**
 * Time and date utility functions
 */

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