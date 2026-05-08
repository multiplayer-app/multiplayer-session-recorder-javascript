import { useLayoutEffect, useRef, type ReactElement } from 'react'
import { ScrollBoxRenderable } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { ActionButton, FooterHints, CopyableCommand } from '../shared/index.js'
import { DemoRunInstructions } from '../DemoRunInstructions.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
  onBack?: () => void
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
          <DemoRunInstructions dir={dir} workspace={config.workspace} project={config.project} />
          <box flexDirection='column' gap={1}>
            <text attributes={tuiAttrs({ bold: true })}>Optional: connect your own Git remote</text>
            <text attributes={tuiAttrs({ dim: true })}>
              The demo app is reinitialized without the template repository remote. Add your own repository before
              pushing.
            </text>
            <box flexDirection='column' gap={0}>
              <CopyableCommand command='git remote add origin <your-repository-url>' />
              <CopyableCommand command='git branch -M main' />
              <CopyableCommand command='git push -u origin main' />
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
