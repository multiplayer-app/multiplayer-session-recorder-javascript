import { CheckSuccessIcon } from './icons'

export const toastTemplate = (message: string, sessionUrl?: string) => `
  <div class="mp-toast-content">
    <div class="mp-toast-icon">${CheckSuccessIcon}</div>
    <div class="mp-toast-message">${message}</div>
    ${sessionUrl ? `<a href="${sessionUrl}" target="_blank" rel="noopener noreferrer" class="mp-toast-button">Open session</a>` : ''}
  </div>
`