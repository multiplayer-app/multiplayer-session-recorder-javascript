import type { ReactElement } from 'react'

interface InputFieldProps {
  value: string
  onInput: (value: string) => void
  onSubmit: (payload: any) => void
  placeholder?: string
  width?: number
  borderColor?: string
}

/**
 * A bordered input field with a cyan ❯ chevron icon.
 * Consistent input style used across ApiKey, Model, ProjectSelect steps.
 */
export function InputField({
  value,
  onInput,
  onSubmit,
  placeholder,
  width,
  borderColor = '#22d3ee'
}: InputFieldProps): ReactElement {
  return (
    <box border={true} borderStyle='rounded' borderColor={borderColor} padding={1} flexDirection='row' gap={2}>
      <text fg='#22d3ee'>❯ </text>
      <input
        width={width}
        flexGrow={width ? undefined : 1}
        value={value}
        onInput={onInput}
        onSubmit={onSubmit}
        placeholder={placeholder}
        focusedBackgroundColor='transparent'
        focused={true}
      />
    </box>
  ) as ReactElement
}
