import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { openUrl } from '../lib/openUrl.js'
import { CopyableCommand, clickHandler } from './shared/index.js'

interface Props {
  dir: string
  workspace?: string
  project?: string
  alignCenter?: boolean
}

function DemoRunInstructionsImpl({ dir, workspace, project, alignCenter = false }: Props): ReactElement {
  const agentsUrl =
    workspace && project ? `https://go.multiplayer.app/project/${workspace}/${project}/default/agents` : null

  return (
    <box flexDirection='column' flexShrink={0} gap={1} width='100%'>
      <box flexDirection='column' alignItems={alignCenter ? 'center' : undefined} gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Run the Demo App</text>
        <text attributes={tuiAttrs({ dim: true })}>
          The demo includes a Vite client and an Express server. Start both from the cloned app root.
        </text>
      </box>

      <box flexDirection='column' gap={0}>
        <CopyableCommand command={`cd ${dir}`} />
        <CopyableCommand command='npm run dev' />
      </box>

      <box flexDirection='column' alignItems='flex-start' gap={0}>
        <text attributes={tuiAttrs({ bold: true })}>Open the demo app</text>
        <text attributes={tuiAttrs({ dim: true })}>Open the demo app in your browser.</text>
        <box marginTop={1} onMouseUp={clickHandler(() => openUrl('http://localhost:5173'))}>
          <text>
            <span fg='#22d3ee' attributes={tuiAttrs({ underline: true })}>
              http://localhost:5173
            </span>
          </text>
        </box>
      </box>

      <box flexDirection='column' gap={0} alignItems='flex-start'>
        <text attributes={tuiAttrs({ bold: true })}>Open the Multiplayer dashboard</text>
        <text attributes={tuiAttrs({ dim: true })}>
          Watch agent activity for this project on the Multiplayer dashboard.
        </text>
        <box marginTop={1} onMouseUp={agentsUrl ? clickHandler(() => openUrl(agentsUrl)) : undefined}>
          <text>
            <span fg='#22d3ee' attributes={tuiAttrs({ underline: true })}>
              {agentsUrl ?? 'https://go.multiplayer.app'}
            </span>
          </text>
        </box>
      </box>
    </box>
  ) as ReactElement
}

export const DemoRunInstructions = DemoRunInstructionsImpl as (props: Props) => ReactElement
