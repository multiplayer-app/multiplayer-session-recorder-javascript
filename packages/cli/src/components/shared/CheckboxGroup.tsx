import type { ReactElement } from 'react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { ACCENT, BORDER_MUTED, FG_DIM, FG_LABEL, FG_LABEL_STRONG, FG_MUTED } from './tuiTheme.js'

export type CheckState = 'on' | 'off' | 'mixed'

export type CheckboxSelection = { mode: 'all' } | { mode: 'specific'; values: Set<string> }

export interface CheckboxItem {
  value: string
  label: string
  desc?: string
}

export function toggleCheckboxSelection(
  prev: CheckboxSelection,
  value: string,
  allValues: string[]
): CheckboxSelection {
  if (prev.mode === 'all') {
    const next = new Set(allValues.filter((v) => v !== value))
    if (next.size === 0) return { mode: 'all' }
    return { mode: 'specific', values: next }
  }
  const next = new Set(prev.values)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  if (next.size === 0) return { mode: 'all' }
  if (next.size === allValues.length) return { mode: 'all' }
  return { mode: 'specific', values: next }
}

export function selectionFromValues(values: string[] | undefined, allValues: string[]): CheckboxSelection {
  if (!values?.length) return { mode: 'all' }
  const allowed = new Set(allValues)
  const filtered = values.filter((v) => allowed.has(v))
  if (filtered.length === 0) return { mode: 'all' }
  if (filtered.length === allValues.length) return { mode: 'all' }
  return { mode: 'specific', values: new Set(filtered) }
}

export function selectionToValues(selection: CheckboxSelection): string[] | null {
  if (selection.mode === 'all') return null
  return [...selection.values].sort()
}

export interface CheckboxProps {
  rowKey: string
  label: string
  desc?: string
  state: CheckState
  focused: boolean
  onActivate: () => void
  onFocus?: () => void
  maxLabelWidth?: number
}

export function Checkbox({
  rowKey,
  label,
  desc,
  state,
  focused,
  onActivate,
  onFocus,
  maxLabelWidth
}: CheckboxProps): ReactElement {
  const prefix = state === 'mixed' ? '[-]' : state === 'on' ? '[x]' : '[ ]'
  const prefixActive = state !== 'off'
  const borderCol = focused ? ACCENT : BORDER_MUTED

  const truncated =
    typeof maxLabelWidth === 'number' && label.length > maxLabelWidth
      ? `${label.slice(0, Math.max(0, maxLabelWidth - 3))}...`
      : label

  const handleMouseUp = (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    onFocus?.()
    onActivate()
  }

  return (
    <box
      key={rowKey}
      id={`cb-${rowKey}`}
      flexDirection='column'
      border={true}
      borderStyle='rounded'
      borderColor={borderCol}
      paddingLeft={1}
      onMouseUp={handleMouseUp}
    >
      <box flexDirection='row' gap={1}>
        <text fg={prefixActive ? ACCENT : FG_DIM}>{prefix}</text>
        <text fg={focused ? FG_LABEL_STRONG : FG_LABEL}>{truncated}</text>
      </box>
      {desc && (
        <text fg={FG_MUTED} attributes={tuiAttrs({ dim: true })}>
          {desc}
        </text>
      )}
    </box>
  ) as ReactElement
}

export interface CheckboxGroupProps {
  /** Group display name (also used to build the default "All" label). */
  name: string
  /** Prefix for row IDs/keys; e.g. "env" → `env-all`, `env:value`. */
  keyPrefix: string
  /** Override the auto-generated "All <name>" label. */
  allLabel?: string
  items: CheckboxItem[]
  selection: CheckboxSelection
  onChange: (next: CheckboxSelection) => void
  /** Focused row key from the parent's flat focus list, or null. */
  focusedKey: string | null
  /** Notify parent that this row should become focused (e.g. on click). */
  onFocus: (key: string) => void
  maxLabelWidth?: number
  marginTop?: number
}

export function checkboxGroupKeys(keyPrefix: string, items: CheckboxItem[]): string[] {
  return [`${keyPrefix}-all`, ...items.map((i) => `${keyPrefix}:${i.value}`)]
}

export function CheckboxGroup({
  name,
  keyPrefix,
  allLabel,
  items,
  selection,
  onChange,
  focusedKey,
  onFocus,
  maxLabelWidth,
  marginTop = 0
}: CheckboxGroupProps): ReactElement {
  const allKey = `${keyPrefix}-all`
  const allValues = items.map((i) => i.value)
  const allOn = selection.mode === 'all'
  const someSpecific = selection.mode === 'specific'
  const allState: CheckState = allOn ? 'on' : someSpecific ? 'mixed' : 'off'

  const itemState = (value: string): CheckState => {
    if (allOn) return 'on'
    if (selection.mode === 'specific' && selection.values.has(value)) return 'on'
    return 'off'
  }

  return (
    <box flexDirection='column' gap={0} marginTop={marginTop}>
      <text fg={FG_MUTED} attributes={tuiAttrs({ bold: true })}>
        {name}
      </text>
      <Checkbox
        rowKey={allKey}
        label={allLabel ?? `All ${name.toLowerCase()}`}
        state={allState}
        focused={focusedKey === allKey}
        onActivate={() => onChange({ mode: 'all' })}
        onFocus={() => onFocus(allKey)}
        maxLabelWidth={maxLabelWidth}
      />
      {items.map((item) => {
        const rowKey = `${keyPrefix}:${item.value}`
        return (
          <Checkbox
            key={rowKey}
            rowKey={rowKey}
            label={item.label}
            desc={item.desc}
            state={itemState(item.value)}
            focused={focusedKey === rowKey}
            onActivate={() => onChange(toggleCheckboxSelection(selection, item.value, allValues))}
            onFocus={() => onFocus(rowKey)}
            maxLabelWidth={maxLabelWidth}
          />
        )
      })}
    </box>
  ) as ReactElement
}
