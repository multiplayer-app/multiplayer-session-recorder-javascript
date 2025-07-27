import { CloseXIcon, LogoSvg } from './icons'

export const finalPopoverTemplate = `
<div class="mp-session-debugger-popover-content">
  <div class="mp-session-debugger-popover-header">
    <a href="https://www.multiplayer.app" target="_blank" rel="noopener noreferrer" title="Multiplayer">
        <div class="mp-session-debugger-popover-logo">${LogoSvg}</div>
    </a>
    <button class="mp-session-debugger-dismiss-button">Dismiss report</button>
    <button class="mp-session-debugger-modal-close" aria-label="Close">${CloseXIcon}</button>
  </div>
  <div class="mp-session-debugger-popover-body">
    <h2>Done capturing?</h2>
    <p>Click the button below to save your report. Optionally, feel free to send a message to Multiplayer.</p>
    <textarea placeholder="Add a comment..." class="mp-session-debugger-popover-textarea"></textarea>
    <div class="mp-session-debugger-popover-footer">
      <button class="mp-session-debugger-popover-button mp-stop-recording">Save</button>
    </div>
  </div>
</div>
`