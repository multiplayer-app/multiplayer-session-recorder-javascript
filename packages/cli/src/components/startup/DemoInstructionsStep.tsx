import { type ReactElement } from 'react'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { ActionButton, FooterHints } from '../shared/index.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
  onBack?: () => void
}

function CommandLine({ command }: { command: string }): ReactElement {
  return (
    <box flexDirection='row' gap={1}>
      <text fg='#22d3ee'>$</text>
      <text fg='#e6edf3'>{command}</text>
    </box>
  ) as ReactElement
}

export function DemoInstructionsStep({ config, onComplete, onBack }: Props): ReactElement {
  const startAgent = () => onComplete({ demoInstructionsDone: true })

  useKeyboard(({ name }) => {
    if (name === 'return') startAgent()
    else if (name === 'escape') onBack?.()
  })

  const dir = config.dir ?? '<demo-app-directory>'

  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Run the Demo App</text>
      <text attributes={tuiAttrs({ dim: true })}>
        The demo includes a Vite client and an Express server. Start both from the cloned app root.
      </text>

      <box flexDirection='column' border={true} borderStyle='rounded' borderColor='#30363d' padding={1} marginTop={1}>
        <CommandLine command={`cd ${dir}`} />
        <CommandLine command='npm install' />
        <CommandLine command='npm dev' />
      </box>

      <box flexDirection='column' marginTop={1} gap={0}>
        <text>
          Frontend: <span fg='#22d3ee'>http://localhost:5173</span>
        </text>
        <text>
          Backend: <span fg='#22d3ee'>http://localhost:8787</span>
        </text>
        <text attributes={tuiAttrs({ dim: true })}>Vite proxies /api requests to the backend.</text>
      </box>

      <box marginTop={1}>
        <ActionButton label='Start agent' icon='→' iconColor='#10b981' labelColor='#10b981' onClick={startAgent} />
      </box>

      <FooterHints hints='Enter start agent · Esc back' />
    </box>
  ) as ReactElement
}
