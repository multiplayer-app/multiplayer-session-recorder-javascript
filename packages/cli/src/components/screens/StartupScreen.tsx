import { useState, useCallback, useEffect, useLayoutEffect, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { createApiService } from '../../services/api.service.js'
import { API_URL } from '../../config.js'
import { writeCredentials, addProject, writeProjectSettings, listAccounts } from '../../cli/profile.js'
import { Logo } from '../Logo.js'
import { AccountSelectStep } from '../startup/AccountSelectStep.js'
import { AuthMethodStep } from '../startup/AuthMethodStep.js'
import { ProjectSelectStep, type SelectableWorkspace } from '../startup/ProjectSelectStep.js'
import { WorkspaceStep } from '../startup/WorkspaceStep.js'
import { DirectoryStep } from '../startup/DirectoryStep.js'
import { ModelStep } from '../startup/ModelStep.js'
import { RateLimitsStep } from '../startup/RateLimitsStep.js'
import { ConnectingStep } from '../startup/ConnectingStep.js'
import { MultiplayerSdkStep } from '../startup/MultiplayerSdkStep.js'

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepId =
  | 'account-select'
  | 'auth-method'
  | 'project-select'
  | 'workspace'
  | 'directory'
  | 'model'
  | 'rate-limits'
  | 'session-recorder'
  | 'connecting'

interface StepMeta {
  title: string
  description: string
  shortLabel: string
  sidebarGroup?: string
  canSkip: (c: Partial<AgentConfig>) => boolean
}

const STEP_DEFS: Record<StepId, StepMeta> = {
  'account-select': {
    title: 'Select Account',
    description: 'Link this project to an existing Multiplayer account or add a new one.',
    shortLabel: 'Account',
    sidebarGroup: 'auth',
    canSkip: (c) => !!c.apiKey || listAccounts().length === 0
  },
  'auth-method': {
    title: 'Authentication',
    description: 'Choose how to authenticate with Multiplayer.',
    shortLabel: 'Auth',
    sidebarGroup: 'auth',
    canSkip: (c) => !!c.apiKey
  },
  'project-select': {
    title: 'Select Project',
    description: 'Choose the project this agent will monitor.',
    shortLabel: 'Project',
    sidebarGroup: 'auth',
    canSkip: (c) => {
      if (c.authType === 'oauth' && !(c.workspace && c.project)) return false
      return !!(c.workspace && c.project)
    }
  },
  workspace: {
    title: 'Workspace Confirmation',
    description: 'Review the workspace and project that will receive agent updates.',
    shortLabel: 'Workspace',
    sidebarGroup: 'auth',
    canSkip: (c) => !!(c.workspace && c.project && c.apiKey)
  },
  directory: {
    title: 'Repository Directory',
    description: 'Select the git repository where patches, commits, and branches are created.',
    shortLabel: 'Directory',
    canSkip: (c) => !!c.dir
  },
  model: {
    title: 'AI Model',
    description: 'Choose an AI provider and model for issue resolution.',
    shortLabel: 'Model',
    canSkip: (c) => !!(c.model && (c.model.startsWith('claude') || c.modelKey))
  },
  'rate-limits': {
    title: 'Concurrency',
    description: 'Set how many issues can be processed in parallel.',
    shortLabel: 'Concurrency',
    canSkip: (c) => typeof c.maxConcurrentIssues === 'number'
  },
  'session-recorder': {
    title: 'Session Recorder',
    description: 'Detect your app stack and set up the Multiplayer Session Recorder SDK.',
    shortLabel: 'Multiplayer SDK',
    canSkip: (c) => !!c.sessionRecorderSetupDone || !!process.env.MULTIPLAYER_SKIP_SR_SETUP
  },
  connecting: {
    title: 'Final Checks',
    description: 'Verify git and provider requirements before starting runtime.',
    shortLabel: 'Verify',
    canSkip: () => false
  }
}

const STEPS = Object.keys(STEP_DEFS) as StepId[]

// ─── Route map ────────────────────────────────────────────────────────────────

function prevStep(current: StepId, config: Partial<AgentConfig>): StepId | null {
  switch (current) {
    case 'account-select':
      return null
    case 'auth-method':
      return listAccounts().length > 0 ? 'account-select' : null
    case 'project-select':
      return 'auth-method'
    case 'workspace':
      return config.authType === 'oauth' ? 'project-select' : 'auth-method'
    case 'directory':
      return config.authType === 'oauth' ? 'project-select' : 'auth-method'
    case 'model':
      return 'directory'
    case 'rate-limits':
      return 'model'
    case 'session-recorder':
      return 'rate-limits'
    case 'connecting':
      return 'session-recorder'
  }
}

function nextStep(afterStep: StepId, config: Partial<AgentConfig>): StepId {
  const idx = STEPS.indexOf(afterStep)
  for (let i = idx + 1; i < STEPS.length; i++) {
    if (!STEP_DEFS[STEPS[i]!].canSkip(config)) return STEPS[i]!
  }
  return 'connecting'
}

function firstRequiredStep(config: Partial<AgentConfig>): StepId {
  for (const s of STEPS) {
    if (!STEP_DEFS[s].canSkip(config)) return s
  }
  return 'connecting'
}

const SELF_NAVIGATING_STEPS: Set<StepId> = new Set(['project-select'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_PANEL_WIDTH = 24

function compactContextLabel(name: string | undefined, id: string | undefined): string {
  const raw = (name?.trim() || id || '—').trim()
  if (raw === '—') return raw
  return raw.length > 26 ? `${raw.slice(0, 12)}…${raw.slice(-11)}` : raw
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialConfig: Partial<AgentConfig>
  profileName?: string
  authErrorMessage?: string | null
  onComplete: (config: AgentConfig) => void
}

export function StartupScreen({ initialConfig, profileName, authErrorMessage, onComplete }: Props): ReactElement | null {
  const [config, setConfig] = useState<Partial<AgentConfig>>(initialConfig)
  const [step, setStep] = useState<StepId>(() => firstRequiredStep(initialConfig))
  const [ready, setReady] = useState(false)
  const [oauthWorkspaces, setOauthWorkspaces] = useState<SelectableWorkspace[]>([])
  const [fetchingWorkspaces, setFetchingWorkspaces] = useState(false)
  const [oauthApi, setOauthApi] = useState<ReturnType<typeof createApiService> | null>(null)

  // ── Navigation ────────────────────────────────────────────────────────────

  const account = profileName ?? 'default'

  const advance = useCallback(
    (updates: Partial<AgentConfig>) => {
      const next = { ...config, ...updates }
      setConfig(next)

      // Credentials (auth only) → ~/.multiplayer/credentials.json
      const creds: Parameters<typeof writeCredentials>[1] = {}
      if (next.authType !== 'oauth' && next.apiKey) creds.apiKey = next.apiKey
      if (next.authType) creds.authType = next.authType
      if (next.url) creds.url = next.url
      writeCredentials(account, creds)

      // Project settings → <dir>/.multiplayer/settings.json
      if (next.dir) {
        addProject(next.dir, account)
        writeProjectSettings(next.dir, {
          workspace: next.workspace,
          project: next.project,
          model: next.model,
          modelKey: next.modelKey,
          modelUrl: next.modelUrl,
          maxConcurrentIssues: next.maxConcurrentIssues,
        })
      }

      setStep(nextStep(step, next))
    },
    [config, step, account]
  )

  const goBack = useCallback(() => {
    const prev = prevStep(step, config)
    if (prev) setStep(prev)
  }, [step, config])

  useKeyboard(({ name }) => {
    if (name !== 'escape' || SELF_NAVIGATING_STEPS.has(step)) return
    goBack()
  })

  // ── Side effects ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 'project-select' || oauthWorkspaces.length > 0 || fetchingWorkspaces) return
    const apiKey = config.apiKey?.trim()
    if (!apiKey) return

    setFetchingWorkspaces(true)
    const url = config.url || API_URL
    const api = createApiService({ url, apiKey: '', bearerToken: apiKey })
    setOauthApi(api)
    void api
      .fetchUserSession()
      .then(async (session) => {
        const workspaces: SelectableWorkspace[] = await Promise.all(
          session.workspaces.map(async (ws) => ({
            _id: ws._id,
            name: ws.name,
            projects: (await api.fetchProjects(ws._id)).filter((p) => !!p._id && !!p.name)
          }))
        )
        writeCredentials(account, { authType: 'oauth' })
        setConfig((c) => ({ ...c, authType: 'oauth' }))
        setOauthWorkspaces(workspaces)
      })
      .catch(() => { /* empty list handled by ProjectSelectStep */ })
      .finally(() => setFetchingWorkspaces(false))
  }, [step])

  useLayoutEffect(() => {
    console.clear()
    setReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    console.clear()
  }, [ready, step])

  useEffect(() => {
    const onResize = () => { console.clear() }
    process.stdout.on('resize', onResize)
    return () => { process.stdout.off('resize', onResize) }
  }, [])

  useEffect(() => {
    const url = config.url || API_URL
    const apiKey = config.apiKey?.trim()
    const { workspace, project } = config
    if (!apiKey || !workspace || !project) return

    let cancelled = false
    void (async () => {
      try {
        const api = createApiService({ url, apiKey })
        const [ws, proj] = await Promise.all([api.fetchWorkspace(workspace), api.fetchProject(workspace, project)])
        if (cancelled) return
        const workspaceDisplayName = ws?.name?.trim()
        const projectDisplayName = proj?.name?.trim()
        if (!workspaceDisplayName && !projectDisplayName) return
        setConfig((c) => {
          if (c.apiKey?.trim() !== apiKey || c.workspace !== workspace || c.project !== project) return c
          return {
            ...c,
            ...(workspaceDisplayName ? { workspaceDisplayName } : {}),
            ...(projectDisplayName ? { projectDisplayName } : {}),
          }
        })
      } catch { /* non-fatal */ }
    })()

    return () => { cancelled = true }
  }, [config.apiKey, config.workspace, config.project, config.url])

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const currentStepIndex = STEPS.indexOf(step)
  const visibleSteps = STEPS.filter(
    (s, i) => i <= currentStepIndex || !STEP_DEFS[s].canSkip(config) || s === 'connecting'
  )
  const currentVisibleIndex = visibleSteps.indexOf(step)

  type SidebarEntry = { id: string; label: string; isDone: boolean; isCurrent: boolean }
  const sidebarSteps: SidebarEntry[] = []
  const groupsSeen = new Set<string>()

  for (const s of visibleSteps) {
    const def = STEP_DEFS[s]
    const group = def.sidebarGroup

    if (group) {
      if (groupsSeen.has(group)) continue
      groupsSeen.add(group)
      const lastGroupIdx = visibleSteps.reduce((acc, vs, i) => (STEP_DEFS[vs].sidebarGroup === group ? i : acc), -1)
      const anyGroupCurrent = visibleSteps.some((vs) => STEP_DEFS[vs].sidebarGroup === group && vs === step)
      sidebarSteps.push({
        id: `group-${group}`,
        label: 'Auth',
        isDone: lastGroupIdx < currentVisibleIndex,
        isCurrent: anyGroupCurrent,
      })
    } else {
      const i = visibleSteps.indexOf(s)
      sidebarSteps.push({ id: s, label: def.shortLabel, isDone: i < currentVisibleIndex, isCurrent: s === step })
    }
  }

  const currentSidebarIndex = sidebarSteps.findIndex((e) => e.isCurrent)
  const label = STEP_DEFS[step]
  const done = Math.max(0, currentSidebarIndex)
  const total = Math.max(1, sidebarSteps.length)
  const progressPrefix = `${currentSidebarIndex + 1}/${sidebarSteps.length}`
  const progressWidth = Math.max(8, STEP_PANEL_WIDTH - 6 - progressPrefix.length)
  const filled = Math.round((done / (total - 1 || 1)) * progressWidth)
  const maskedApiKey = config.apiKey ? `${config.apiKey.slice(0, 4)}••••${config.apiKey.slice(-3)}` : '—'
  const provider = config.model?.startsWith('claude') ? 'Claude' : config.model ? 'OpenAI-compatible' : '—'
  const compactDir = config.dir
    ? config.dir.length > 30 ? `${config.dir.slice(0, 14)}…${config.dir.slice(-14)}` : config.dir
    : '—'
  const setupWorkspaceLabel = compactContextLabel(config.workspaceDisplayName, config.workspace)
  const setupProjectLabel = compactContextLabel(config.projectDisplayName, config.project)

  if (!ready) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <box flexDirection='column' padding={1}>
      <Logo />
      <box flexDirection='row' gap={1} alignItems='stretch'>
        {/* Left sidebar */}
        <box width={STEP_PANEL_WIDTH} flexDirection='column'>
          <text attributes={tuiAttrs({ bold: true })}>Setup Steps</text>
          {sidebarSteps.map((entry) => {
            const marker = entry.isDone ? '✓' : entry.isCurrent ? '❯' : '·'
            const color = entry.isDone ? '#10b981' : entry.isCurrent ? '#22d3ee' : '#6b7280'
            return (
              <text key={entry.id} fg={color} attributes={tuiAttrs({ bold: entry.isCurrent })}>
                {marker} {entry.label}
              </text>
            )
          })}
          <box marginTop={1} flexDirection='row'>
            <text attributes={tuiAttrs({ dim: true })}>{progressPrefix} </text>
            <text fg='#22d3ee'>{'█'.repeat(filled)}</text>
            <text attributes={tuiAttrs({ dim: true })}>{'░'.repeat(progressWidth - filled)}</text>
          </box>
        </box>

        {/* Right content pane */}
        <box flexDirection='column' flexGrow={1}>
          <box flexDirection='column' flexShrink={0} marginBottom={1}>
            <text attributes={tuiAttrs({ bold: true })}>{label.title}</text>
            <text attributes={tuiAttrs({ dim: true })}>{label.description}</text>
            {authErrorMessage && step === 'auth-method' && (
              <text fg='#f87171'>Session expired or unauthorized — please sign in again.</text>
            )}
          </box>

          <box
            border={true}
            borderStyle='rounded'
            borderColor='#30363d'
            paddingLeft={1}
            paddingRight={1}
            paddingTop={0}
            paddingBottom={0}
            marginBottom={1}
            flexDirection='column'
            flexGrow={1}
            flexShrink={0}
            gap={1}
          >
            <box flexDirection='row' flexWrap='wrap'>
              <text attributes={tuiAttrs({ dim: true })}>API key </text>
              <text attributes={tuiAttrs({ bold: true })}>{maskedApiKey}</text>
              <text attributes={tuiAttrs({ dim: true })}> · Workspace </text>
              <text attributes={tuiAttrs({ bold: true })}>{setupWorkspaceLabel}</text>
              <text attributes={tuiAttrs({ dim: true })}> / </text>
              <text attributes={tuiAttrs({ bold: true })}>{setupProjectLabel}</text>
            </box>
            <box flexDirection='row' flexWrap='wrap'>
              <text attributes={tuiAttrs({ dim: true })}>Dir </text>
              <text>{compactDir}</text>
              <text attributes={tuiAttrs({ dim: true })}> · Model </text>
              <text attributes={tuiAttrs({ bold: true })}>{config.model ?? '—'}</text>
              <text attributes={tuiAttrs({ dim: true })}> ({provider}) · Concurrency </text>
              <text attributes={tuiAttrs({ bold: true })}>{config.maxConcurrentIssues ?? '—'}</text>
            </box>
            <text attributes={tuiAttrs({ dim: true })}>
              Account {account} · Enter confirm · Esc back · Ctrl+C quit
            </text>
          </box>

          {step === 'account-select' && (
            <AccountSelectStep
              onComplete={(updates) => advance(updates)}
              onAddNew={() => setStep('auth-method')}
            />
          )}
          {step === 'auth-method' && (
            <AuthMethodStep
              config={config}
              url={config.url || API_URL}
              profileName={profileName}
              onComplete={(updates) => {
                if ((updates as any)._oauthWorkspaces) {
                  const workspaces = (updates as any)._oauthWorkspaces as SelectableWorkspace[]
                  setOauthWorkspaces(workspaces)
                  const next = { ...config, apiKey: updates.apiKey }
                  setConfig(next)
                  const url = next.url || API_URL
                  setOauthApi(createApiService({ url, apiKey: '', bearerToken: updates.apiKey! }))
                  setStep('project-select')
                } else {
                  advance(updates)
                }
              }}
            />
          )}
          {step === 'project-select' && (
            <ProjectSelectStep
              workspaces={oauthWorkspaces}
              profileName={profileName}
              loading={fetchingWorkspaces}
              onComplete={advance}
              onBack={goBack}
              onCreateWorkspace={
                oauthApi
                  ? async (name, handle) => {
                      const ws = await oauthApi.createWorkspace(name, handle)
                      return { _id: ws._id!, name: ws.name!, projects: [] }
                    }
                  : undefined
              }
              onCreateProject={
                oauthApi
                  ? async (workspaceId, name) => oauthApi.createProject(workspaceId, name)
                  : undefined
              }
            />
          )}
          {step === 'workspace' && <WorkspaceStep config={config} onComplete={advance} />}
          {step === 'directory' && <DirectoryStep config={config} onComplete={advance} />}
          {step === 'model' && <ModelStep config={config} onComplete={advance} />}
          {step === 'rate-limits' && <RateLimitsStep config={config} onComplete={advance} />}
          {step === 'session-recorder' && <MultiplayerSdkStep config={config} onComplete={advance} onBack={goBack} />}
          {step === 'connecting' && (
            <ConnectingStep config={config as AgentConfig} onComplete={onComplete} onBack={goBack} />
          )}
        </box>
      </box>
    </box>
  ) as ReactElement
}
