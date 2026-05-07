import { useLayoutEffect, useRef, type ReactElement } from 'react'
import { ScrollBoxRenderable } from '@opentui/core'
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
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const startAgent = () => onComplete({ demoInstructionsDone: true })

  useLayoutEffect(() => {
    scrollRef.current?.scrollBy(-1, 'content')
  }, [])

  useKeyboard((key) => {
    const { name } = key
    if (name === 'return') startAgent()
    else if (name === 'escape') onBack?.()
    else if (name === 'up') {
      scrollRef.current?.scrollBy(-1, 'content')
      key.stopPropagation()
    } else if (name === 'down') {
      scrollRef.current?.scrollBy(1, 'content')
      key.stopPropagation()
    }
  })

  const dir = config.dir ?? '<demo-app-directory>'

  return (
    <box flexDirection='column' flexGrow={1} flexShrink={1} overflow={'hidden' as const}>
      <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} scrollY focused={false}>
        <box flexDirection='column' flexShrink={0} gap={1} width='100%'>
          <text attributes={tuiAttrs({ bold: true })}>Run the Demo App</text>
          <text attributes={tuiAttrs({ dim: true })}>
            The demo includes a Vite client and an Express server. Start both from the cloned app root.
          </text>

          <box flexDirection='column' border={true} borderStyle='rounded' borderColor='#30363d' padding={1}>
            <CommandLine command={`cd ${dir}`} />
            <CommandLine command='npm install' />
            <CommandLine command='npm run dev' />
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

          <box flexDirection='column' marginTop={1} gap={1}>
            <text attributes={tuiAttrs({ bold: true })}>Optional: connect your own Git remote</text>
            <text attributes={tuiAttrs({ dim: true })}>
              The demo app is reinitialized without the template repository remote. Add your own repository before
              pushing.
            </text>
            <box flexDirection='column' border={true} borderStyle='rounded' borderColor='#30363d' padding={1}>
              <CommandLine command='git remote add origin <your-repository-url>' />
              <CommandLine command='git branch -M main' />
              <CommandLine command='git push -u origin main' />
            </box>
          </box>
        </box>
      </scrollbox>

      <box marginTop={1} flexShrink={0}>
        <ActionButton label='Start agent' icon='→' iconColor='#10b981' labelColor='#10b981' onClick={startAgent} />
      </box>

      <FooterHints hints='↑↓ scroll · Enter start agent · Esc back' />
    </box>
  ) as ReactElement
}
