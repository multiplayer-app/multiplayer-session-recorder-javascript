import { useState, useEffect, useLayoutEffect, useRef, type ReactElement } from 'react'
import { ScrollBoxRenderable } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { collapseForSingleLine } from '../../lib/formatDisplay.js'
import type { ApiProject } from '../../services/api.service.js'
import { stringFromInputSubmit } from '../../lib/inputSubmit.js'
import { InputField, FooterHints, Divider, clickHandler } from '../shared/index.js'

function sanitizeName(name: string): string {
  return collapseForSingleLine(name.replace(/\\'/g, "'").replace(/\\"/g, '"'))
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
  onBack?: () => void
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
      backgroundColor: '#374151'
    }
  }
}

export function ProjectSelectStep({
  workspaces: initialWorkspaces,
  profileName,
  loading,
  onComplete,
  onBack,
  onCreateWorkspace,
  onCreateProject
}: Props): ReactElement {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [selected, setSelected] = useState(0)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [inputMode, setInputMode] = useState<null | { kind: 'workspace' } | { kind: 'project'; workspaceId: string }>(
    null
  )
  const [inputValue, setInputValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  // Sync workspaces when prop changes (e.g. loaded after fetch)
  useLayoutEffect(() => {
    setWorkspaces(initialWorkspaces)
  }, [initialWorkspaces])

  const buildOptions = (wsList: SelectableWorkspace[]): FlatOption[] => {
    const opts: FlatOption[] = wsList.flatMap((ws) => [
      ...ws.projects.map((proj) => ({ type: 'project' as const, workspace: ws, project: proj })),
      ...(onCreateProject ? [{ type: 'new-project' as const, workspace: ws }] : [])
    ])
    if (onCreateWorkspace) opts.push({ type: 'new-workspace' as const })
    return opts
  }

  const options = buildOptions(workspaces)

  useEffect(() => {
    const opt = options[selected]
    if (!opt) return
    if (opt.type === 'project') {
      scrollRef.current?.scrollChildIntoView(`proj-${opt.workspace._id}-${opt.project._id}`)
    } else if (opt.type === 'new-project') {
      scrollRef.current?.scrollChildIntoView(`new-proj-${opt.workspace._id}`)
    } else {
      scrollRef.current?.scrollChildIntoView('new-workspace')
    }
  }, [selected, options.length])

  useKeyboard(({ name }) => {
    if (inputMode) {
      if (name === 'escape') {
        setInputMode(null)
        setInputValue('')
        setError(null)
      }
      return
    }
    if (name === 'escape' && onBack) {
      onBack()
      return
    }
    if (name === 'up' || name === 'k') setSelected((s) => Math.max(0, s - 1))
    else if (name === 'down' || name === 'j') setSelected((s) => Math.min(options.length - 1, s + 1))
    else if (name === 'return') selectOption(selected)
  })

  const selectOption = (index: number) => {
    const opt = options[index]
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

    onComplete({
      workspace: opt.workspace._id,
      project: opt.project._id,
      workspaceDisplayName: sanitizeName(opt.workspace.name),
      projectDisplayName: sanitizeName(opt.project.name)
    })
  }

  const handleCreateSubmit = async (value: string) => {
    const name = value.trim()
    if (!name || !inputMode) return
    setCreating(true)
    setError(null)
    try {
      if (inputMode.kind === 'workspace' && onCreateWorkspace) {
        const handle = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        const newWs = await onCreateWorkspace(name, handle)
        const updated = [...workspaces, newWs]
        setWorkspaces(updated)
        setInputMode(null)
        setInputValue('')
        const newOpts = buildOptions(updated)
        const idx = newOpts.findIndex((o) => o.type === 'new-project' && o.workspace._id === newWs._id)
        if (idx >= 0) setSelected(idx)
      } else if (inputMode.kind === 'project' && onCreateProject) {
        const newProj = await onCreateProject(inputMode.workspaceId, name)
        const updated = workspaces.map((ws) =>
          ws._id === inputMode.workspaceId ? { ...ws, projects: [...ws.projects, newProj] } : ws
        )
        setWorkspaces(updated)
        setInputMode(null)
        setInputValue('')
        const newOpts = buildOptions(updated)
        const idx = newOpts.findIndex((o) => o.type === 'project' && o.project._id === newProj._id)
        if (idx >= 0) setSelected(idx)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Creation failed')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#f59e0b'>◌ Loading workspaces...</text>
      </box>
    ) as ReactElement
  }

  if (!options.length) {
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#ef4444'>No projects found for this account.</text>
      </box>
    ) as ReactElement
  }

  if (inputMode) {
    const label = inputMode.kind === 'workspace' ? 'New workspace name' : 'New project name'
    const placeholder = inputMode.kind === 'workspace' ? 'My Workspace' : 'My Project'
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#6b7280'>{label}</text>
        {error && <text fg='#ef4444'>✗ {error}</text>}
        {creating ? (
          <text fg='#f59e0b'>◌ Creating...</text>
        ) : (
          <InputField
            value={inputValue}
            onInput={setInputValue}
            onSubmit={(p) => {
              void handleCreateSubmit(stringFromInputSubmit(p, inputValue))
            }}
            placeholder={placeholder}
            width={40}
          />
        )}
        <FooterHints hints='Enter create · Esc cancel' />
      </box>
    ) as ReactElement
  }

  // Build rows grouped by workspace
  const rows: ReactElement[] = []
  let lastWsId = ''
  for (let i = 0; i < options.length; i++) {
    const opt = options[i]!
    const isActive = i === selected
    const isHovered = hoveredRow === i
    const bg = isActive ? '#161b22' : isHovered ? '#21262d' : undefined

    const mouse = {
      onMouseUp: clickHandler(() => selectOption(i)),
      onMouseOver: () => setHoveredRow(i),
      onMouseOut: () => setHoveredRow((v: number | null) => (v === i ? null : v))
    }

    if (opt.type === 'new-workspace') {
      if (rows.length > 0) rows.push((<Divider key='div-new-ws' marginTop={1} />) as ReactElement)
      rows.push(
        // @ts-ignore
        <box
          key='new-workspace'
          id='new-workspace'
          flexDirection='row'
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={bg}
          marginBottom={1}
          {...mouse}
        >
          <box width={3} flexShrink={0}>
            <text fg='#f59e0b'>+</text>
          </box>
          <text fg={isActive ? '#e6edf3' : '#f59e0b'} attributes={tuiAttrs({ bold: isActive })}>
            New workspace
          </text>
        </box>
      )
      continue
    }

    // Workspace group header
    if (opt.workspace._id !== lastWsId) {
      if (lastWsId) rows.push((<Divider key={`div-${opt.workspace._id}`} marginTop={1} />) as ReactElement)
      lastWsId = opt.workspace._id
      rows.push(
        // @ts-ignore
        <box key={`ws-${opt.workspace._id}`} paddingLeft={1} paddingRight={1} marginTop={0} flexDirection='column'>
          <text fg='#6b7280' attributes={tuiAttrs({ bold: true })}>
            {sanitizeName(opt.workspace.name)}
          </text>
          <Divider />
        </box>
      )
    }

    if (opt.type === 'new-project') {
      rows.push(
        // @ts-ignore
        <box
          key={`new-proj-${opt.workspace._id}`}
          id={`new-proj-${opt.workspace._id}`}
          flexDirection='row'
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={bg}
          {...mouse}
        >
          <box width={3} flexShrink={0}>
            <text fg='#f59e0b'>+</text>
          </box>
          <text fg={isActive ? '#e6edf3' : '#f59e0b'} attributes={tuiAttrs({ bold: isActive })}>
            New project
          </text>
        </box>
      )
      continue
    }

    rows.push(
      // @ts-ignore
      <box
        key={`proj-${opt.workspace._id}-${opt.project._id}`}
        id={`proj-${opt.workspace._id}-${opt.project._id}`}
        flexDirection='row'
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={bg}
        {...mouse}
      >
        <box width={3} flexShrink={0}>
          <text fg={isActive ? '#22d3ee' : '#6b7280'}>{isActive ? '◆' : '◇'}</text>
        </box>
        <text fg={isActive ? '#e6edf3' : '#c9d1d9'} attributes={tuiAttrs({ bold: isActive })}>
          {sanitizeName(opt.project.name)}
        </text>
      </box>
    )
  }

  return (
    <box flexDirection='column' flexGrow={1}>
      <text fg='#6b7280'>Select the project for this agent to monitor.</text>
      <box
        flexDirection='column'
        border={true}
        borderStyle='rounded'
        borderColor='#30363d'
        flexGrow={1}
        overflow={'hidden' as const}
        marginTop={1}
      >
        <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={SCROLLBAR_STYLE}>
          <box flexDirection='column'>{rows}</box>
        </scrollbox>
      </box>
      <FooterHints hints='↑↓ navigate · Enter select · Click to select · Esc back' marginTop={1} />
    </box>
  ) as ReactElement
}
