/**
 * Time and date utility functions for React Native
 */

export const getFormattedDate = (date: number | Date, options?: any): string => {
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
