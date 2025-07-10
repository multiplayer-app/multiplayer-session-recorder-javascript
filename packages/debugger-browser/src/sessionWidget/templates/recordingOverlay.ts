import { RecordIndicatorIcon, StopIcon, DragHandleIcon } from './icons'

export const recordingOverlayTemplate = `
<div class="mp-recording-status">
  <div class="mp-recording-indicator">
    ${RecordIndicatorIcon}
  </div>
  <span class="timer">00:00</span>
</div>
<div class="mp-recording-controls">
  <button class="mp-recording-btn mp-stop-btn" title="Stop recording">${StopIcon}</button>
</div>
<div class="mp-drag-handle" style="cursor: move;">
  ${DragHandleIcon}
</div>
`