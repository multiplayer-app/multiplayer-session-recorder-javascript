/** OpenTUI types `onSubmit` as an intersection of string and empty `SubmitEvent` handlers; use `unknown` at the boundary. */
export type InputSubmitPayload = unknown

export function stringFromInputSubmit(payload: InputSubmitPayload, fallback: string): string {
  return typeof payload === 'string' ? payload : fallback
}
