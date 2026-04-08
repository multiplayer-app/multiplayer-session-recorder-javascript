import { useState, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { ScrollBoxRenderable } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { writeProfile } from '../../cli/profile.js'
import { collapseForSingleLine } from '../../lib/formatDisplay.js'
import { ApiProject } from '../../services/api.service.js'

function sanitizeName(name: string): string {
  return collapseForSingleLine(name.replace(/\\'/g, "'").replace(/\\"/g, '"'))
}

export interface SelectableWorkspace {
  _id: string
  name: string
  projects: ApiProject[]
}

interface Props {
  workspaces: SelectableWorkspace[]
  profileName?: string
  onComplete: (updates: Partial<AgentConfig>) => void
}

const SCROLLBAR_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: true,
    trackOptions: {
      foregroundColor: '#22d3ee',
      backgroundColor: '#374151'
    }
  }
}

export function ProjectSelectStep({ workspaces, profileName, onComplete }: Props): ReactElement {
  // Flatten to a single list of workspace+project pairs
  const options = workspaces.flatMap((ws) => ws.projects.map((proj) => ({ workspace: ws, project: proj })))

  const [selected, setSelected] = useState(0)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  useLayoutEffect(() => {
    const opt = options[selected]
    if (!opt) return
    scrollRef.current?.scrollChildIntoView(`proj-${opt.workspace._id}-${opt.project._id}`)
  }, [selected])

  useKeyboard(({ name }) => {
    if (name === 'up' || name === 'k') setSelected((s) => Math.max(0, s - 1))
    else if (name === 'down' || name === 'j') setSelected((s) => Math.min(options.length - 1, s + 1))
    else if (name === 'return') handleConfirm()
  })

  const handleConfirm = () => {
    const opt = options[selected]
    if (!opt) return

    const profile = profileName || process.env.MULTIPLAYER_PROFILE || 'default'
    writeProfile(profile, { workspace: opt.workspace._id, project: opt.project._id })

    onComplete({
      workspace: opt.workspace._id,
      project: opt.project._id,
      workspaceDisplayName: sanitizeName(opt.workspace.name),
      projectDisplayName: sanitizeName(opt.project.name)
    })
  }

  if (!options.length) {
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#ef4444'>No projects found for this account.</text>
      </box>
    ) as ReactElement
  }

  // Build a flat list of rows: workspace headers + project rows
  const rows: ReactNode[] = []
  let lastWsId = ''
  for (let i = 0; i < options.length; i++) {
    const opt = options[i]!
    const isCurrent = i === selected
    if (opt.workspace._id !== lastWsId) {
      lastWsId = opt.workspace._id
      rows.push(
        <box key={`ws-${opt.workspace._id}`} height={1} marginTop={rows.length === 0 ? 0 : 1}>
          <text attributes={tuiAttrs({ dim: true })}>{sanitizeName(opt.workspace.name)}</text>
        </box>
      )
    }
    rows.push(
      <box key={`proj-${opt.workspace._id}-${opt.project._id}`} flexDirection='row' height={1} gap={1}>
        <text fg={isCurrent ? '#22d3ee' : '#6b7280'}>{isCurrent ? '❯' : ' '}</text>
        <text fg={isCurrent ? '#22d3ee' : undefined} attributes={tuiAttrs({ bold: isCurrent })}>
          {sanitizeName(opt.project.name)}
        </text>
      </box>
    )
  }

  return (
    <box flexDirection='column' flexGrow={1}>
      <text attributes={tuiAttrs({ dim: true })}>Select the project for this agent to monitor.</text>
      <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={SCROLLBAR_STYLE} marginTop={1}>
        <box flexDirection='column'>{rows}</box>
      </scrollbox>
      <text attributes={tuiAttrs({ dim: true })} marginTop={1}>
        ↑↓ to select · Enter to confirm
      </text>
    </box>
  ) as ReactElement
}
