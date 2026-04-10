import { useState, type ReactElement } from 'react'
import type { KeyEvent, MouseEvent } from '@opentui/core'
import { MouseButton, RGBA } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import type { QuitMode } from '../../runtime/types.js'

type Option = QuitMode | 'cancel'

const QUIT_BACKDROP_BG = RGBA.fromInts(10, 10, 12, 150)

/** Selection border + key hints (FooterHints-style) */
const ACCENT = { keys: '#22d3ee' } as const

const OPTIONS: { value: Option; digit: string; label: string; description: string }[] = [
  {
    value: 'now',
    digit: '1',
    label: 'Quit now',
    description: 'Stop immediately — active sessions are abandoned',
  },
  {
    value: 'after-current',
    digit: '2',
    label: 'Quit when idle',
    description: 'Finish active sessions, then exit',
  },
  {
    value: 'cancel',
    digit: '3',
    label: 'Cancel',
    description: 'Return to the dashboard',
  },
]

interface Props {
  onQuit: (mode: QuitMode) => void
  onCancel: () => void
}

function applyOption(opt: (typeof OPTIONS)[number], onQuit: (mode: QuitMode) => void, onCancel: () => void): void {
  if (opt.value === 'cancel') onCancel()
  else onQuit(opt.value)
}

export function QuitScreen({ onQuit, onCancel }: Props): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { width, height } = useTerminalDimensions()

  const runOption = (index: number) => {
    const opt = OPTIONS[index]
    if (opt) applyOption(opt, onQuit, onCancel)
  }

  useKeyboard((key: KeyEvent) => {
    const { name } = key
    if (name === 'up') {
      setSelectedIndex((i) => Math.max(0, i - 1))
      key.stopPropagation()
    } else if (name === 'down') {
      setSelectedIndex((i) => Math.min(OPTIONS.length - 1, i + 1))
      key.stopPropagation()
    } else if (name === 'return') {
      runOption(selectedIndex)
      key.stopPropagation()
    } else if (name === 'escape' || name === 'q') {
      onCancel()
      key.stopPropagation()
    } else {
      const n = OPTIONS.findIndex((o) => o.digit === name)
      if (n >= 0) {
        setSelectedIndex(n)
        runOption(n)
        key.stopPropagation()
      }
    }
  })

  const rowMouseUp = (index: number) => (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    setSelectedIndex(index)
    runOption(index)
  }

  const backdropMouseUp = (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    onCancel()
  }

  const dialogMouseUp = (e: MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <box
      position='absolute'
      top={0}
      left={0}
      width={width}
      height={height}
      alignItems='center'
      paddingTop={height / 4}
      backgroundColor={QUIT_BACKDROP_BG}
      onMouseUp={backdropMouseUp}
    >
      <box
        flexDirection='column'
        width={68}
        maxWidth={width - 2}
        minWidth={52}
        backgroundColor='#262626'
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        gap={0}
        onMouseUp={dialogMouseUp}
      >
        <text fg='#e5e5e5' attributes={tuiAttrs({ bold: true })}>
          Quit Multiplayer Debugging Agent?
        </text>
        <text attributes={tuiAttrs({ dim: true })}>Choose how to exit — or press Esc to go back.</text>

        <box flexDirection='column' gap={0} marginTop={1}>
          {OPTIONS.map((opt, i) => {
            const isSelected = i === selectedIndex
            return (
              <box
                key={opt.value}
                flexDirection='column'
                border={true}
                borderStyle='rounded'
                borderColor={isSelected ? ACCENT.keys : '#374151'}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
                gap={0}
                onMouseUp={rowMouseUp(i)}
              >
                <text fg={isSelected ? '#fafafa' : '#a1a1aa'} attributes={tuiAttrs({ bold: isSelected })}>
                  {opt.label}
                </text>
                <text attributes={tuiAttrs({ dim: true })}>{opt.description}</text>
              </box>
            )
          })}
        </box>

        <box marginTop={1} flexDirection='row' flexWrap='wrap' gap={0}>
          <text fg={ACCENT.keys} attributes={tuiAttrs({ bold: true })}>
            ↑↓
          </text>
          <text attributes={tuiAttrs({ dim: true })}> move · </text>
          <text fg={ACCENT.keys} attributes={tuiAttrs({ bold: true })}>
            Enter
          </text>
          <text attributes={tuiAttrs({ dim: true })}> select · </text>
          <text fg={ACCENT.keys} attributes={tuiAttrs({ bold: true })}>
            1-3
          </text>
          <text attributes={tuiAttrs({ dim: true })}> quick pick · Esc cancel</text>
        </box>
      </box>
    </box>
  ) as ReactElement
}
