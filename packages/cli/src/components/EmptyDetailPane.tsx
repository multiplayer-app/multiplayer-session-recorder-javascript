import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'

const BRAND_PRIMARY = '#6366f1'
const BRAND_ACCENT = '#22d3ee'
const DIM = '#4b5563'
const MUTED = '#6b7280'

const DIAMOND_ART = [
  '          ◆          ',
  '        ◆ ◆ ◆        ',
  '      ◆ ◆ ◆ ◆ ◆      ',
  '        ◆ ◆ ◆        ',
  '          ◆          ',
]

interface Props {
  /** Whether sessions exist but none is selected, vs no sessions at all. */
  hasSessions: boolean
}

function EmptyDetailPaneImpl({ hasSessions }: Props): ReactElement {
  return (
    <box
      flexDirection='column'
      flexGrow={1}
      justifyContent='center'
      alignItems='center'
      gap={1}
    >
      {/* Diamond artwork */}
      <box flexDirection='column' alignItems='center'>
        {DIAMOND_ART.map((line, i) => (
          <text key={i} fg={BRAND_PRIMARY} attributes={tuiAttrs({ dim: i !== 2 })}>
            {line}
          </text>
        ))}
      </box>

      {/* Title */}
      <box marginTop={1}>
        <text fg={BRAND_ACCENT} attributes={tuiAttrs({ bold: true })}>
          multiplayer
        </text>
      </box>

      {/* Contextual message */}
      {hasSessions ? (
        <box flexDirection='column' alignItems='center' marginTop={1} gap={0}>
          <text fg={MUTED}>
            Select a session from the list to view details
          </text>
          <box flexDirection='row' gap={1} marginTop={1}>
            <text fg={BRAND_ACCENT} attributes={tuiAttrs({ bold: true })}>
              {'  '}
            </text>
            <text fg={DIM}>navigate</text>
            <text fg={MUTED}>{'  '}</text>
            <text fg={BRAND_ACCENT} attributes={tuiAttrs({ bold: true })}>
              {'  '}
            </text>
            <text fg={DIM}>open</text>
            <text fg={MUTED}>{'  '}</text>
            <text fg={BRAND_ACCENT} attributes={tuiAttrs({ bold: true })}>
              i
            </text>
            <text fg={DIM}>compose</text>
          </box>
        </box>
      ) : (
        <box flexDirection='column' alignItems='center' marginTop={1} gap={0}>
          <text fg={MUTED}>
            Waiting for issues to arrive...
          </text>
          <text fg={DIM} attributes={tuiAttrs({ dim: true })}>
            Issues will appear here as they are detected
          </text>
          <box flexDirection='row' gap={1} marginTop={1}>
            <text fg='#f59e0b'>{'  '}</text>
            <text fg={DIM}>listening</text>
          </box>
        </box>
      )}
    </box>
  ) as ReactElement
}

export const EmptyDetailPane = EmptyDetailPaneImpl as (props: Props) => ReactElement
