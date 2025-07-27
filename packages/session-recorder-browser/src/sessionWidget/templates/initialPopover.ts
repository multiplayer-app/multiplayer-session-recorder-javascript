import { LogoSvg, CloseXIcon, CapturingIcon } from './icons'

export const initialPopoverTemplate = `
<div class="mp-session-debugger-popover-content">
  <div class="mp-session-debugger-popover-header">
    <a href="https://www.multiplayer.app" target="_blank" rel="noopener noreferrer" title="Multiplayer">
        <div class="mp-session-debugger-popover-logo">${LogoSvg}</div>
    </a>
    <button class="mp-session-debugger-modal-close" aria-label="Close">${CloseXIcon}</button>
  </div>
  <div class="mp-session-debugger-popover-body">
    <div class="mp-session-debugger-continuous-debugging">
      <div class="mp-session-debugger-continuous-debugging-label">
        Continuous recording
      </div>
      <label class="mp-session-debugger-continuous-debugging-switch">
        <input type="checkbox" id="mp-session-debugger-continuous-debugging-checkbox">
        <span></span>
      </label>
    </div>
    <h2>Encountered an issue?</h2>
    <p>Help us improve by sharing what went wrong. We'll record your steps, so we can see exactly what happened.</p>
    <div class="mp-session-debugger-popover-footer">
      <button class="mp-session-debugger-popover-button mp-start-recording">Start Recording!</button>
    </div>
    <div class="mp-session-debugger-continuous-debugging-overlay">
      <div class="mp-session-debugger-continuous-debugging-overlay-content">
        <h3>${CapturingIcon} You’re continuously recording.</h3>
        <p>
         Press the save button to save your last snapshot. You can continue debugging after saving.
        </p>
      </div>
      <button class="mp-session-debugger-popover-button" id="mp-save-continuous-debug-session">Save last snapshot</button>
    </div>
  </div>
</div>
`