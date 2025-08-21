import { CloseXIcon, LogoSvg } from './icons'
import { WidgetTextOverridesConfig } from '../../types'

export const finalPopoverTemplate = (popoverText: WidgetTextOverridesConfig) => `
<div class="mp-session-debugger-popover-content">
  <div class="mp-session-debugger-popover-header">
    <a href="https://www.multiplayer.app" target="_blank" rel="noopener noreferrer" title="Multiplayer">
        <div class="mp-session-debugger-popover-logo">${LogoSvg}</div>
    </a>
    <button class="mp-session-debugger-dismiss-button">${popoverText.cancelButtonText}</button>
    <button class="mp-session-debugger-modal-close" aria-label="Close">${CloseXIcon}</button>
  </div>
  <div class="mp-session-debugger-popover-body">
    <h2>${popoverText.finalTitle}</h2>
    <p>${popoverText.finalDescription}</p>
    <textarea placeholder="${popoverText.commentPlaceholder}" class="mp-session-debugger-popover-textarea"></textarea>
    <div class="mp-session-debugger-popover-footer">
      <button class="mp-session-debugger-popover-button mp-stop-recording">${popoverText.saveButtonText}</button>
    </div>
  </div>
</div>
`
