import { useState, useLayoutEffect, useRef, type ReactElement } from 'react'
import { ScrollBoxRenderable } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { writeProfile } from '../../cli/profile.js'
import { collapseForSingleLine } from '../../lib/formatDisplay.js'
import type { ApiProject } from '../../services/api.service.js'
import { stringFromInputSubmit } from '../../lib/inputSubmit.js'

function sanitizeName(name: string): string {
  return collapseForSingleLine(name.replace(/\\'/g, '\'').replace(/\\"/g, '"'))
}

export interface SelectableWorkspace {
  _id: string
  name: string
  projects: ApiProject[]
}

type FlatOption =
  | { type: 'project'; workspace: SelectableWorkspace; project: { _id: string; name: string } }
  | { type: 'new-project'; workspace: SelectableWorkspace }
  | { type: 'new-workspace' }

interface Props {
  workspaces: SelectableWorkspace[]
  profileName?: string
  loading?: boolean
  onComplete: (updates: Partial<AgentConfig>) => void
  onCreateWorkspace?: (name: string, handle: string) => Promise<SelectableWorkspace>
  onCreateProject?: (workspaceId: string, name: string) => Promise<{ _id: string; name: string }>
}

const SCROLLBAR_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: true,
    trackOptions: {
      foregroundColor: '#22d3ee',
      backgroundColor: '#374151',
    },
  },
}

export function ProjectSelectStep({ workspaces: initialWorkspaces, profileName, loading, onComplete, onCreateWorkspace, onCreateProject }: Props): ReactElement {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [selected, setSelected] = useState(0)
  const [inputMode, setInputMode] = useState<null | { kind: 'workspace' } | { kind: 'project'; workspaceId: string }>(null)
  const [inputValue, setInputValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  // Sync workspaces when prop changes (e.g. loaded after fetch)
  useLayoutEffect(() => {
    setWorkspaces(initialWorkspaces)
  }, [initialWorkspaces])

  const buildOptions = (wsList: SelectableWorkspace[]): FlatOption[] => {
    const opts: FlatOption[] = wsList.flatMap(ws => [
      ...ws.projects.map(proj => ({ type: 'project' as const, workspace: ws, project: proj })),
      ...(onCreateProject ? [{ type: 'new-project' as const, workspace: ws }] : []),
    ])
    if (onCreateWorkspace) opts.push({ type: 'new-workspace' as const })
    return opts
  }

  const options = buildOptions(workspaces)

  useLayoutEffect(() => {
    const opt = options[selected]
    if (!opt) return
    if (opt.type === 'project') {
      scrollRef.current?.scrollChildIntoView(`proj-${opt.workspace._id}-${opt.project._id}`)
    } else if (opt.type === 'new-project') {
      scrollRef.current?.scrollChildIntoView(`new-proj-${opt.workspace._id}`)
    } else {
      scrollRef.current?.scrollChildIntoView('new-workspace')
    }
  }, [selected])

  useKeyboard(({ name }) => {
    if (inputMode) {
      if (name === 'escape') {
        setInputMode(null)
        setInputValue('')
        setError(null)
      }
      return
    }
    if (name === 'up' || name === 'k') setSelected(s => Math.max(0, s - 1))
    else if (name === 'down' || name === 'j') setSelected(s => Math.min(options.length - 1, s + 1))
    else if (name === 'return') handleConfirm()
  })

  const handleConfirm = () => {
    const opt = options[selected]
    if (!opt) return

    if (opt.type === 'new-workspace') {
      setInputMode({ kind: 'workspace' })
      setInputValue('')
      setError(null)
      return
    }

    if (opt.type === 'new-project') {
      setInputMode({ kind: 'project', workspaceId: opt.workspace._id })
      setInputValue('')
      setError(null)
      return
    }

    const profile = profileName || process.env.MULTIPLAYER_PROFILE || 'default'
    writeProfile(profile, { workspace: opt.workspace._id, project: opt.project._id })

    onComplete({
      workspace: opt.workspace._id,
      project: opt.project._id,
      workspaceDisplayName: sanitizeName(opt.workspace.name),
      projectDisplayName: sanitizeName(opt.project.name),
    })
  }

  const handleCreateSubmit = async (value: string) => {
    const name = value.trim()
    if (!name || !inputMode) return
    setCreating(true)
    setError(null)
    try {
      if (inputMode.kind === 'workspace' && onCreateWorkspace) {
        const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const newWs = await onCreateWorkspace(name, handle)
        const updated = [...workspaces, newWs]
        setWorkspaces(updated)
        setInputMode(null)
        setInputValue('')
        const newOpts = buildOptions(updated)
        const idx = newOpts.findIndex(o => o.type === 'new-project' && o.workspace._id === newWs._id)
        if (idx >= 0) setSelected(idx)
      } else if (inputMode.kind === 'project' && onCreateProject) {
        const newProj = await onCreateProject(inputMode.workspaceId, name)
        const updated = workspaces.map(ws =>
          ws._id === inputMode.workspaceId
            ? { ...ws, projects: [...ws.projects, newProj] }
            : ws,
        )
        setWorkspaces(updated)
        setInputMode(null)
        setInputValue('')
        const newOpts = buildOptions(updated)
        const idx = newOpts.findIndex(o => o.type === 'project' && o.project._id === newProj._id)
        if (idx >= 0) {
          setSelected(idx)
          const ws = updated.find(w => w._id === inputMode.workspaceId)!
          const profile = profileName || process.env.MULTIPLAYER_PROFILE || 'default'
          writeProfile(profile, { workspace: ws._id, project: newProj._id })
          onComplete({
            workspace: ws._id,
            project: newProj._id,
            workspaceDisplayName: sanitizeName(ws.name),
            projectDisplayName: sanitizeName(newProj.name),
          })
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Creation failed')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg="#f59e0b">◌ Loading workspaces...</text>
      </box>
    ) as ReactElement
  }

  if (!options.length) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg="#ef4444">No projects found for this account.</text>
      </box>
    ) as ReactElement
  }

  if (inputMode) {
    const label = inputMode.kind === 'workspace' ? 'New workspace name' : 'New project name'
    const placeholder = inputMode.kind === 'workspace' ? 'My Workspace' : 'My Project'
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ dim: true })}>{label}</text>
        {error && <text fg="#ef4444">✗ {error}</text>}
        {creating ? (
          <text fg="#f59e0b">◌ Creating...</text>
        ) : (
          <box border={true} borderStyle="rounded" borderColor="#22d3ee" padding={1} flexDirection="row" gap={1}>
            <text fg="#22d3ee">❯</text>
            <input
              width={40}
              value={inputValue}
              onInput={setInputValue}
              onSubmit={(p) => { void handleCreateSubmit(stringFromInputSubmit(p, inputValue)) }}
              placeholder={placeholder}
              focusedBackgroundColor="transparent"
            />
          </box>
        )}
        <text attributes={tuiAttrs({ dim: true })}>Enter to create · Esc to cancel</text>
      </box>
    ) as ReactElement
  }

  // Build a flat list of rows: workspace headers + project rows + create entries
  const rows: ReactElement[] = []
  let lastWsId = ''
  for (let i = 0; i < options.length; i++) {
    const opt = options[i]!
    const isCurrent = i === selected

    if (opt.type === 'new-workspace') {
      rows.push(
        // eslint-disable-next-line
        // @ts-ignore
        <box key="new-workspace" flexDirection="row" height={1} gap={1} marginTop={1}>
          <text fg={isCurrent ? '#22d3ee' : '#6b7280'}>{isCurrent ? '❯' : ' '}</text>
          <text fg={isCurrent ? '#22d3ee' : '#6b7280'} attributes={tuiAttrs({ bold: isCurrent })}>
            + New workspace
          </text>
        </box>,
      )
      continue
    }

    if (opt.workspace._id !== lastWsId) {
      lastWsId = opt.workspace._id
      rows.push(
        // eslint-disable-next-line
        // @ts-ignore
        <box key={`ws-${opt.workspace._id}`} height={1} marginTop={rows.length === 0 ? 0 : 1}>
          <text attributes={tuiAttrs({ dim: true })}>{sanitizeName(opt.workspace.name)}</text>
        </box>,
      )
    }
    if (opt.type === 'new-project') {
      rows.push(
        // eslint-disable-next-line
        // @ts-ignore
        <box key={`new-proj-${opt.workspace._id}`} flexDirection="row" height={1} gap={1}>
          <text fg={isCurrent ? '#22d3ee' : '#6b7280'}>{isCurrent ? '❯' : ' '}</text>
          <text fg={isCurrent ? '#22d3ee' : '#6b7280'} attributes={tuiAttrs({ bold: isCurrent })}>
            + New project
          </text>
        </box>,
      )
      continue
    }

    rows.push(
      // eslint-disable-next-line
      // @ts-ignore
      <box key={`proj-${opt.workspace._id}-${opt.project._id}`} flexDirection="row" height={1} gap={1}>
        <text fg={isCurrent ? '#22d3ee' : '#6b7280'}>{isCurrent ? '❯' : ' '}</text>
        <text fg={isCurrent ? '#22d3ee' : undefined} attributes={tuiAttrs({ bold: isCurrent })}>
          {sanitizeName(opt.project.name)}
        </text>
      </box>,
    )
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <text attributes={tuiAttrs({ dim: true })}>Select the project for this agent to monitor.</text>
      <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={SCROLLBAR_STYLE} marginTop={1}>
        <box flexDirection="column">{rows}</box>
      </scrollbox>
      <text attributes={tuiAttrs({ dim: true })} marginTop={1}>
        ↑↓ to select · Enter to confirm
      </text>
    </box>
  ) as ReactElement
}
