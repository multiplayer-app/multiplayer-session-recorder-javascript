import { useState, useMemo, type ReactElement } from 'react'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { rm } from 'fs/promises'
import { useKeyboard } from '@opentui/react'
import path from 'path'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { DEFAULT_MAX_CONCURRENT, DEMO_REPO_URL } from '../../config.js'
import { FooterHints, SelectionList, type SelectionItem } from '../shared/index.js'
import { DirectoryStep } from './DirectoryStep.js'
import { listProjects, loadProfile, touchProject, type ProjectEntry } from '../../cli/profile.js'
import { OAuthManager } from '../../auth/oauth-manager.js'

const execFileAsync = promisify(execFile)

type SubStep = 'select' | 'pick-parent' | 'cloning' | 'loading' | 'error'

interface Props {
  onComplete: (updates: Partial<AgentConfig> & { _accountName?: string }) => void
}

type PrimaryNavItem = { kind: 'existing' } | { kind: 'example' }
type ProjectNavItem = { kind: 'project'; entry: ProjectEntry }
type NavItem = ProjectNavItem | PrimaryNavItem

const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [{ kind: 'example' }, { kind: 'existing' }]
const PRIMARY_SELECTION_ITEMS: SelectionItem[] = [
  {
    key: 'example',
    icon: '◇',
    iconColor: '#f59e0b',
    label: 'Try a demo',
    description: 'Clone and explore the Multiplayer demo app'
  },
  {
    key: 'existing',
    icon: '◆',
    iconColor: '#22d3ee',
    label: 'Setup existing project',
    description: 'Link an existing repository to Multiplayer'
  }
]

export function ProjectTypeStep({ onComplete }: Props): ReactElement {
  const [selected, setSelected] = useState(0)
  const [subStep, setSubStep] = useState<SubStep>('select')
  const [errorBackStep, setErrorBackStep] = useState<SubStep>('select')
  const [error, setError] = useState<string | null>(null)

  const registeredProjects = useMemo(() => listProjects(), [])

  const projectNavItems = useMemo<ProjectNavItem[]>(
    () => registeredProjects.map((entry) => ({ kind: 'project', entry })),
    [registeredProjects]
  )
  const navItems = useMemo<NavItem[]>(() => [...PRIMARY_NAV_ITEMS, ...projectNavItems], [projectNavItems])

  const projectSelectionItems = useMemo<SelectionItem[]>(
    () =>
      projectNavItems.map((item) => {
        const entry = item.entry
        return {
          key: `project:${entry.account}:${entry.path}`,
          icon: '◆',
          iconColor: '#22d3ee',
          label: path.basename(entry.path),
          description: `${entry.path} · ${entry.account}`
        }
      }),
    [projectNavItems]
  )

  useKeyboard((key) => {
    const { name } = key
    if (subStep === 'error' && name === 'escape') {
      setError(null)
      setSubStep(errorBackStep)
      key.stopPropagation()
      return
    }
    if (subStep !== 'select') return
    if (name === 'up' || name === 'k') setSelected((s) => Math.max(0, s - 1))
    else if (name === 'down' || name === 'j') setSelected((s) => Math.min(navItems.length - 1, s + 1))
    else if (name === 'return') handleSelect(selected)
  })

  const handleSelect = (idx: number) => {
    const item = navItems[idx]
    if (!item) return
    if (item.kind === 'existing') {
      onComplete({})
    } else if (item.kind === 'example') {
      setSubStep('pick-parent')
    } else {
      setSubStep('loading')
      void (async () => {
        try {
          const { entry } = item
          touchProject(entry.path)
          const profile = loadProfile(entry.account, entry.path)
          let apiKey = profile.apiKey

          if (profile.authType === 'oauth') {
            const oauthManager = new OAuthManager(entry.account)
            const token = await oauthManager.getAccessToken()
            if (!token) {
              onComplete({ dir: entry.path, _accountName: entry.account })
              return
            }
            apiKey = token
          }

          onComplete({
            dir: profile.dir ?? entry.path,
            apiKey,
            authType: profile.authType,
            workspace: profile.workspace,
            project: profile.project,
            model: profile.model,
            modelKey: profile.modelKey,
            modelUrl: profile.modelUrl,
            maxConcurrentIssues: profile.maxConcurrentIssues,
            sessionRecorderSetupDone: profile.sessionRecorderSetupDone,
            _accountName: entry.account
          })
        } catch (err: any) {
          setErrorBackStep('select')
          setError(err.message)
          setSubStep('error')
        }
      })()
    }
  }

  const handleParentDirSelected = async ({ dir }: Partial<AgentConfig>) => {
    if (!dir) return
    setSubStep('cloning')

    try {
      await execFileAsync('git', ['clone', '--depth=1', DEMO_REPO_URL, dir])
      await rm(path.join(dir, '.git'), { recursive: true, force: true })
      await execFileAsync('git', ['init'], { cwd: dir })
      onComplete({
        dir,
        isDemoProject: true,
        maxConcurrentIssues: DEFAULT_MAX_CONCURRENT,
        sessionRecorderSetupDone: true
      })
    } catch (err: any) {
      setErrorBackStep('pick-parent')
      setError(err.stderr?.trim() || err.message)
      setSubStep('error')
    }
  }

  if (subStep === 'pick-parent') {
    return (
      <DirectoryStep
        config={{}}
        title='Select where to clone the example project'
        allowCreateFolder={true}
        onComplete={handleParentDirSelected}
      />
    ) as ReactElement
  }

  if (subStep === 'cloning') {
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#f59e0b'>◌ Cloning example project...</text>
        <text attributes={tuiAttrs({ dim: true })}>{DEMO_REPO_URL}</text>
      </box>
    ) as ReactElement
  }

  if (subStep === 'loading') {
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#f59e0b'>◌ Loading project...</text>
      </box>
    ) as ReactElement
  }

  if (subStep === 'error') {
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#ef4444'>✗ {error}</text>
        <FooterHints hints='Esc back' />
      </box>
    ) as ReactElement
  }

  return (
    <box flexDirection='column' flexGrow={1} flexShrink={1} gap={1} overflow={'hidden' as const}>
      <SelectionList
        items={PRIMARY_SELECTION_ITEMS}
        selectedIndex={selected < PRIMARY_NAV_ITEMS.length ? selected : -1}
        onSelect={handleSelect}
        flexGrow={0}
        scrollable={false}
      />
      {projectSelectionItems.length > 0 && (
        <>
          <box flexShrink={0}>
            <text attributes={tuiAttrs({ bold: true })}>Recent projects</text>
          </box>
          <SelectionList
            items={projectSelectionItems}
            selectedIndex={selected >= PRIMARY_NAV_ITEMS.length ? selected - PRIMARY_NAV_ITEMS.length : -1}
            onSelect={(idx) => handleSelect(idx + PRIMARY_NAV_ITEMS.length)}
            flexGrow={1}
          />
        </>
      )}
      <FooterHints hints='↑↓ navigate · Enter select · Click to select' />
    </box>
  ) as ReactElement
}
