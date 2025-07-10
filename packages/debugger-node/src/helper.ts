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
