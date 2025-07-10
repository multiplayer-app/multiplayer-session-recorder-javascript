import { POSITION_STATE_KEY } from './constants'

export class DragManager {
  private isDragging: boolean = false
  private dragStarted: boolean = false
  private isOnLeftHalfOfScreen: boolean = false
  private recorderButton: HTMLButtonElement
  private recorderPlacement: string
  private onDragEnd: (isDragging: boolean, isDragStarted: boolean, isOnLeftHalfOfScreen: boolean) => void
  private updatePopoverPosition: () => void
  private onRecordingButtonClick: (e: MouseEvent) => void

  constructor(
    recorderButton: HTMLButtonElement,
    recorderPlacement: string,
    onDragEnd: (isDragging: boolean, isDragStarted: boolean, isOnLeftHalfOfScreen: boolean) => void = () => { },
    updatePopoverPosition: () => void = () => { },
    onRecordingButtonClick: (e: MouseEvent) => void = () => { },
  ) {
    this.recorderButton = recorderButton
    this.recorderPlacement = recorderPlacement
    this.onDragEnd = onDragEnd
    this.updatePopoverPosition = updatePopoverPosition
    this.onRecordingButtonClick = onRecordingButtonClick
  }

  public init() {
    this.loadStoredPosition()
    this.setupDragListeners()
  }

  private loadStoredPosition() {
    const savedPosition = localStorage.getItem(POSITION_STATE_KEY)
    if (!savedPosition) {
      return
    }
    let { right, bottom } = JSON.parse(savedPosition)

    if (right == null || bottom == null) {
      return
    }

    // Check for old stored values (decimals) from localStorage
    const isStoredAsDecimal = right > 0 && right <= 1 && bottom > 0 && bottom <= 1

    if (isStoredAsDecimal) {
      right = right * window.innerWidth
      bottom = bottom * window.innerHeight
    } else {
      right = (right / 100) * window.innerWidth
      bottom = (bottom / 100) * window.innerHeight
    }

    right = Math.min(Math.max(right, 0), window.innerWidth)
    bottom = Math.min(Math.max(bottom, 0), window.innerHeight)

    requestAnimationFrame(() => {
      this.recorderButton.classList.remove(this.recorderPlacement)
      this.recorderButton.style.right = `${right}px`
      this.recorderButton.style.bottom = `${bottom}px`

      this.isOnLeftHalfOfScreen = right > window.innerWidth / 2
      this.recorderButton.classList.toggle('button-leftside', this.isOnLeftHalfOfScreen)

      this.updatePopoverPosition()
    })
  }

  private savePosition(r: number, b: number) {
    const right = (r / window.innerWidth) * 100
    const bottom = (b / window.innerHeight) * 100

    localStorage.setItem(POSITION_STATE_KEY, JSON.stringify({ right, bottom }))
  }

  private setupDragListeners() {
    this.recorderButton.addEventListener('mousedown', (e) => {
      const onMouseUp = () => {
        const isDraggable = !this.recorderButton.classList.contains('no-draggable')

        if (this.isDragging || !isDraggable) {
          this.recorderButton.classList.toggle('button-leftside', this.isOnLeftHalfOfScreen)
          this.isDragging = false
          document.body.style.userSelect = ''

          if (isDraggable) {
            const finalRight = parseFloat(this.recorderButton.style.right)
            const finalBottom = parseFloat(this.recorderButton.style.bottom)
            this.savePosition(finalRight, finalBottom)
            document.removeEventListener('mousemove', onMouseMove)
          }

          if (!this.dragStarted) {
            this.updatePopoverPosition()
            this.onRecordingButtonClick(e)
          }

          this.onDragEnd(this.isDragging, this.dragStarted, this.isOnLeftHalfOfScreen)
        }
        this.recorderButton.classList.remove('no-hover')
        document.removeEventListener('mouseup', onMouseUp)
      }

      if (this.recorderButton.classList.contains('no-draggable')) {
        this.isDragging = false
        this.dragStarted = false
        document.addEventListener('mouseup', onMouseUp)
        return
      }
      this.recorderButton.classList.add('no-hover')
      this.isDragging = true
      this.dragStarted = false
      const startX = e.clientX
      const startY = e.clientY
      const buttonRect = this.recorderButton.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        // If mouse moved significantly, consider it a drag
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          this.dragStarted = true
          this.recorderButton.classList.remove(this.recorderPlacement)

          const newLeft = Math.max(0, Math.min(viewportWidth - buttonRect.width, buttonRect.left + deltaX))
          const newTop = Math.max(0, Math.min(viewportHeight - buttonRect.height, buttonRect.top + deltaY))

          const newRight = viewportWidth - newLeft - buttonRect.width
          const newBottom = viewportHeight - newTop - buttonRect.height

          this.isOnLeftHalfOfScreen = newRight > viewportWidth / 2

          requestAnimationFrame(() => {
            this.recorderButton.style.right = `${newRight}px`
            this.recorderButton.style.bottom = `${newBottom}px`
          })
        }
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)

      document.body.style.userSelect = 'none'
      e.preventDefault()
    })
  }
}