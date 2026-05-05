import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'

import { ACCENT, BRAND_MARK_PRIMARY, FG_DIM, FG_HINT } from './shared/tuiTheme.js'

interface Props {
  hasSessions: boolean
}

function EmptyDetailPaneImpl({ hasSessions }: Props): ReactElement {
  return (
    <box flexDirection='column' flexGrow={1} justifyContent='center' alignItems='center' gap={1}>
      {/* Brand */}
      <text fg={BRAND_MARK_PRIMARY} attributes={tuiAttrs({ bold: true })}>
        ◆ MULTIPLAYER
      </text>

      {/* Contextual message */}
      <box flexDirection='column' alignItems='center' gap={1}>
        {hasSessions ? (
          <>
            <text fg={FG_DIM}>Select a session from the list to view details</text>
            <box flexDirection='row' gap={2}>
              <box flexDirection='row' gap={1}>
                <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
                  ↑↓
                </text>
                <text fg={FG_HINT}>navigate</text>
              </box>
              <box flexDirection='row' gap={1}>
                <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
                  ↵
                </text>
                <text fg={FG_HINT}>open</text>
              </box>
              <box flexDirection='row' gap={1}>
                <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
                  i
                </text>
                <text fg={FG_HINT}>compose</text>
              </box>
            </box>
          </>
        ) : (
          <>
            <text fg={FG_DIM}>Waiting for issues to arrive...</text>
            <text fg={FG_HINT}>Issues will appear here as they are detected</text>
            <text fg={FG_HINT}>Listening...</text>
          </>
        )}
      </box>
    </box>
  ) as ReactElement
}

export const EmptyDetailPane = EmptyDetailPaneImpl as (props: Props) => ReactElement
