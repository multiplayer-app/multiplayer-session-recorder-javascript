import { LogoSvg, CloseXIcon, CapturingIcon } from './icons'
import { WidgetTextOverridesConfig } from '../../types'

export const initialPopoverTemplate = (popoverText: WidgetTextOverridesConfig, showContinuousRecording: boolean) => `
<div class="mp-session-debugger-popover-content">
  <div class="mp-session-debugger-popover-header">
    <a href="https://www.multiplayer.app" target="_blank" rel="noopener noreferrer" title="Multiplayer">
        <div class="mp-session-debugger-popover-logo">${LogoSvg}</div>
    </a>
    <button class="mp-session-debugger-modal-close" aria-label="Close">${CloseXIcon}</button>
  </div>
  <div class="mp-session-debugger-popover-body">
    ${showContinuousRecording ? `
    <div class="mp-session-debugger-continuous-debugging">
      <div class="mp-session-debugger-continuous-debugging-label">
        ${popoverText.continuousRecordingLabel}
      </div>
      <label class="mp-session-debugger-continuous-debugging-switch">
        <input type="checkbox" id="mp-session-debugger-continuous-debugging-checkbox">
        <span></span>
      </label>
    </div>
    ` : ''}
    <h2>${showContinuousRecording ? popoverText.initialTitleWithContinuous : popoverText.initialTitleWithoutContinuous}</h2>
    <p>${showContinuousRecording ? popoverText.initialDescriptionWithContinuous : popoverText.initialDescriptionWithoutContinuous}</p>
    <div class="mp-session-debugger-popover-footer">
      <button class="mp-session-debugger-popover-button mp-start-recording">${popoverText.startRecordingButtonText}</button>
    </div>
    ${showContinuousRecording ? `
    <div class="mp-session-debugger-continuous-debugging-overlay">
      <div class="mp-session-debugger-continuous-debugging-overlay-content">
        <h3>${CapturingIcon} ${popoverText.continuousOverlayTitle}</h3>
        <p>
         ${popoverText.continuousOverlayDescription}
        </p>
      </div>
      <button class="mp-session-debugger-popover-button" id="mp-save-continuous-debug-session">${popoverText.saveLastSnapshotButtonText}</button>
    </div>
    ` : ''}
  </div>
</div>
`
