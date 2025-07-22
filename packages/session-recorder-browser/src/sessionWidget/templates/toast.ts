import { CheckSuccessIcon, ErrorIcon } from './icons'
import { ToastType, ToastConfig } from '../../types'



const getIconForType = (type: ToastType): string => {
  return type === 'success' ? CheckSuccessIcon : ErrorIcon
}

export const toastTemplate = (config: ToastConfig): string => {
  const { type, message, button } = config
  const icon = getIconForType(type)

  const sessionButton = getButtonTemplate(button)

  return `
    <div class="mp-toast mp-toast-${type}" data-toast-type="${type}">
      <div class="mp-toast-content">
        <div class="mp-toast-icon">${icon}</div>
        <div class="mp-toast-message">${message}</div>
        ${sessionButton}
      </div>
    </div>
  `
}

const getButtonTemplate = (button: ToastConfig['button']): string => {
  if (!button) return ''
  if (button.url) return `<a href="${button.url}" target="_blank" rel="noopener noreferrer" class="mp-toast-button">${button.text}</a>`
  if (button.onClick) return `<button class="mp-toast-button">${button.text}</button>`
  return ''
}
