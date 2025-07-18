
export type ToastType = 'success' | 'error'

export interface ToastConfig {
  type: ToastType
  message: string
  button?: {
    text?: string
    url?: string
    onClick?: () => void
  }
}