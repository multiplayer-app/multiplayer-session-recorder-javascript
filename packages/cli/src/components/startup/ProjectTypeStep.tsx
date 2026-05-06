import { useState, useRef, useLayoutEffect, useMemo, type ReactElement } from 'react'
import { ScrollBoxRenderable } from '@opentui/core'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { rm } from 'fs/promises'
import { useKeyboard } from '@opentui/react'
import path from 'path'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { DEFAULT_MAX_CONCURRENT, DEMO_REPO_URL } from '../../config.js'
import { FooterHints } from '../shared/index.js'
import { clickHandler } from '../shared/clickHandler.js'
import { DirectoryStep } from './DirectoryStep.js'
import { listProjects, loadProfile, touchProject, type ProjectEntry } from '../../cli/profile.js'
import { OAuthManager } from '../../auth/oauth-manager.js'

const execFileAsync = promisify(execFile)

const SCROLLBAR_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: false,
    trackOptions: {
      foregroundColor: '#484f58',
      backgroundColor: '#21262d'
    }
  }
} as const

type SubStep = 'select' | 'pick-parent' | 'cloning' | 'loading' | 'error'

interface Props {
  onComplete: (updates: Partial<AgentConfig> & { _accountName?: string }) => void
}

type NavItem = { kind: 'project'; entry: ProjectEntry } | { kind: 'existing' } | { kind: 'example' }

export function ProjectTypeStep({ onComplete }: Props): ReactElement {
  const [selected, setSelected] = useState(0)
  const [subStep, setSubStep] = useState<SubStep>('select')
  const [errorBackStep, setErrorBackStep] = useState<SubStep>('select')
  const [error, setError] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  const registeredProjects = useMemo(() => listProjects(), [])

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [{ kind: 'example' }, { kind: 'existing' }]
    for (const entry of registeredProjects) items.push({ kind: 'project', entry })
    return items
  }, [registeredProjects])

  useLayoutEffect(() => {
    scrollRef.current?.scrollChildIntoView(`pt-item-${selected}`)
  }, [selected])

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
      onComplete({ dir, isDemoProject: true, maxConcurrentIssues: DEFAULT_MAX_CONCURRENT })
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
    <box flexDirection='column' flexGrow={1} gap={1}>
      <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={SCROLLBAR_STYLE}>
        <box flexDirection='column' flexShrink={0} width='100%'>
          {navItems.map((item, i) => {
            const isActive = i === selected
            const isHovered = hoveredIndex === i

            if (item.kind === 'project') {
              const isFirstProject = navItems[i - 1]?.kind !== 'project'
              const label = path.basename(item.entry.path)
              const desc = item.entry.path.length > 52 ? `…${item.entry.path.slice(-49)}` : item.entry.path
              return (
                <box key={`proj-${i}`} flexDirection='column'>
                  {isFirstProject && (
                    <box paddingLeft={1} paddingTop={1} paddingBottom={1}>
                      <text fg='#6b7280' attributes={tuiAttrs({ dim: true })}>
                        Recent projects
                      </text>
                    </box>
                  )}
                  <box
                    id={`pt-item-${i}`}
                    flexDirection='row'
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={0}
                    paddingBottom={1}
                    backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
                    onMouseUp={clickHandler(() => handleSelect(i))}
                    onMouseOver={() => setHoveredIndex(i)}
                    onMouseOut={() => setHoveredIndex((v) => (v === i ? null : v))}
                  >
                    <box width={3} flexShrink={0}>
                      <text fg='#22d3ee'>{isActive ? '❯' : ' '}</text>
                    </box>
                    <box flexDirection='column' flexGrow={1}>
                      <text fg={isActive ? '#e6edf3' : '#c9d1d9'} attributes={tuiAttrs({ bold: isActive })}>
                        {label}
                      </text>
                      <text fg='#484f58'>{desc}</text>
                    </box>
                    <box flexShrink={0} paddingLeft={1}>
                      <text fg='#484f58'>{item.entry.account}</text>
                    </box>
                  </box>
                </box>
              )
            }

            const icon = item.kind === 'existing' ? '◆' : '◇'
            const iconColor = item.kind === 'existing' ? '#22d3ee' : '#f59e0b'
            const label = item.kind === 'existing' ? 'Setup existing project' : 'Try a demo'
            const desc =
              item.kind === 'existing'
                ? 'Link an existing repository to Multiplayer'
                : 'Clone and explore the Multiplayer demo app'

            return (
              <box
                key={item.kind}
                id={`pt-item-${i}`}
                flexDirection='row'
                paddingLeft={1}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={1}
                backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
                onMouseUp={clickHandler(() => handleSelect(i))}
                onMouseOver={() => setHoveredIndex(i)}
                onMouseOut={() => setHoveredIndex((v) => (v === i ? null : v))}
              >
                <box width={3} flexShrink={0}>
                  <text fg={iconColor}>{isActive ? '❯' : icon}</text>
                </box>
                <box flexDirection='column' flexGrow={1}>
                  <text fg={isActive ? '#e6edf3' : '#c9d1d9'} attributes={tuiAttrs({ bold: isActive })}>
                    {label}
                  </text>
                  <text fg='#484f58'>{desc}</text>
                </box>
              </box>
            )
          })}
        </box>
      </scrollbox>

      <FooterHints hints='↑↓ navigate · Enter select · Click to select' />
    </box>
  ) as ReactElement
}
