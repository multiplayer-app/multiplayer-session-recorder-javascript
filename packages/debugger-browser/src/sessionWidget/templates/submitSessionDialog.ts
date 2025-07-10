export const submitSessionDialogTemplate = `
<div class="mp-dialog-backdrop">
  <div class="mp-dialog-content">
    <h3>Submit Recording</h3>
    <div class="subtitle">Report this issue with your debug logs and session replay. Optionally, enter some additional information below.</div>
    <div class="form-group">
      <label>Comment (optional)</label>
      <textarea id="mp-recording-comment" rows="3" placeholder="Add any notes about this recording..."></textarea>
    </div>
    <div class="mp-dialog-actions">
      <button id="mp-cancel-submission">Cancel</button>
      <button id="mp-submit-recording">Submit</button>
    </div>
  </div>
</div>
`