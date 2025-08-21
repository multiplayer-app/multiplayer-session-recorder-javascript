import { WidgetTextOverridesConfig } from '../../types'

export const submitSessionDialogTemplate = (popoverText: WidgetTextOverridesConfig) => `
<div class="mp-dialog-backdrop">
  <div class="mp-dialog-content">
    <h3>${popoverText.submitDialogTitle}</h3>
    <div class="subtitle">${popoverText.submitDialogSubtitle}</div>
    <div class="form-group">
      <label>${popoverText.submitDialogCommentLabel}</label>
      <textarea id="mp-recording-comment" rows="3" placeholder="${popoverText.submitDialogCommentPlaceholder}"></textarea>
    </div>
    <div class="mp-dialog-actions">
      <button id="mp-cancel-submission">${popoverText.submitDialogCancelText}</button>
      <button id="mp-submit-recording">${popoverText.submitDialogSubmitText}</button>
    </div>
  </div>
</div>
`