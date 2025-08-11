import { CloseXIcon, LogoSvg } from './icons'

export const finalPopoverTemplate = `
<div class="mp-session-debugger-popover-content">
  <div class="mp-session-debugger-popover-header">
    <a href="https://www.multiplayer.app" target="_blank" rel="noopener noreferrer" title="Multiplayer">
        <div class="mp-session-debugger-popover-logo">${LogoSvg}</div>
    </a>
    <button class="mp-session-debugger-dismiss-button">Cancel recording</button>
    <button class="mp-session-debugger-modal-close" aria-label="Close">${CloseXIcon}</button>
  </div>
  <div class="mp-session-debugger-popover-body">
    <h2>Done recording?</h2>
    <p>Save your full-stack session recording in our sandbox. 
    You can also leave a quick message, just like a real user would for a bug report.</p>
    <textarea placeholder="Add a message..." class="mp-session-debugger-popover-textarea"></textarea>
    <div class="mp-session-debugger-popover-footer">
      <button class="mp-session-debugger-popover-button mp-stop-recording">Save</button>
    </div>
  </div>
</div>
`
