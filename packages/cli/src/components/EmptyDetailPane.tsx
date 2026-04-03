import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'

const BRAND_PRIMARY = '#6366f1'
const BRAND_ACCENT = '#22d3ee'
const DIM = '#4b5563'
const MUTED = '#6b7280'

interface Props {
  hasSessions: boolean
}

function EmptyDetailPaneImpl({ hasSessions }: Props): ReactElement {
  return (
    <box flexDirection='column' flexGrow={1} justifyContent='center' alignItems='center' gap={1}>
      {/* Brand */}
      <text fg={BRAND_PRIMARY} attributes={tuiAttrs({ bold: true })}>
        ◆ MULTIPLAYER
      </text>

      {/* Contextual message */}
      <box flexDirection='column' alignItems='center' gap={1}>
        {hasSessions ? (
          <>
            <text fg={MUTED}>Select a session from the list to view details</text>
            <box flexDirection='row' gap={2}>
              <box flexDirection='row' gap={1}>
                <text fg={BRAND_ACCENT} attributes={tuiAttrs({ bold: true })}>
                  ↑↓
                </text>
                <text fg={DIM}>navigate</text>
              </box>
              <box flexDirection='row' gap={1}>
                <text fg={BRAND_ACCENT} attributes={tuiAttrs({ bold: true })}>
                  ↵
                </text>
                <text fg={DIM}>open</text>
              </box>
              <box flexDirection='row' gap={1}>
                <text fg={BRAND_ACCENT} attributes={tuiAttrs({ bold: true })}>
                  i
                </text>
                <text fg={DIM}>compose</text>
              </box>
            </box>
          </>
        ) : (
          <>
            <text fg={MUTED}>Waiting for issues to arrive...</text>
            <text fg={DIM} attributes={tuiAttrs({ dim: true })}>
              Issues will appear here as they are detected
            </text>
            <text fg={DIM}>Listening...</text>
          </>
        )}
      </box>
    </box>
  ) as ReactElement
}

export const EmptyDetailPane = EmptyDetailPaneImpl as (props: Props) => ReactElement
