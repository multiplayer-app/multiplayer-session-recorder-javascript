import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
} from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { createApiService } from '../../services/api.service.js'
import { API_URL } from '../../config.js'
import {
  writeCredentials,
  addProject,
  writeProjectSettings,
  setProjectDemo,
  listAccounts,
  readProjectSettings
} from '../../cli/profile.js'
import { Logo } from '../Logo.js'
import { ProjectTypeStep } from '../startup/ProjectTypeStep.js'
import { AccountSelectStep } from '../startup/AccountSelectStep.js'
import { AuthMethodStep } from '../startup/AuthMethodStep.js'
import { ProjectSelectStep, type SelectableWorkspace } from '../startup/ProjectSelectStep.js'
import { WorkspaceStep } from '../startup/WorkspaceStep.js'
import { DirectoryStep } from '../startup/DirectoryStep.js'
import { ModelStep } from '../startup/ModelStep.js'
import { RateLimitsStep } from '../startup/RateLimitsStep.js'
import { ConnectingStep } from '../startup/ConnectingStep.js'
import { MultiplayerSdkStep } from '../startup/MultiplayerSdkStep.js'
import { DemoSetupStep } from '../startup/DemoSetupStep.js'
import { DemoInstructionsStep } from '../startup/DemoInstructionsStep.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEMO_GIT_SETTINGS = {
  commit: false,
  branch_create: false,
  pr_create: false,
  push: false,
  use_worktree: false,
} as const

/**
 * Returns `{ git: DEMO_GIT_SETTINGS }` only if the project hasn't persisted git settings yet.
 * Once the user has toggled them via the Settings panel, we must not overwrite them on every
 * startup-flow advance.
 */
function seedDemoGitIfUnset(dir: string): { git?: typeof DEMO_GIT_SETTINGS } {
  return readProjectSettings(dir).git === undefined ? { git: DEMO_GIT_SETTINGS } : {}
}

function findUniqueDemoProjectName(existingProjects: Array<{ name: string }>): string {
  const names = new Set(existingProjects.map((p) => p.name.toLowerCase()))
  if (!names.has('demo-app')) return 'demo-app'
  let i = 1
  while (names.has(`demo-app-${i}`)) i++
  return `demo-app-${i}`
}

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepId =
  | 'project-type'
  | 'account-select'
  | 'auth-method'
  | 'project-select'
  | 'workspace'
  | 'directory'
  | 'model'
  | 'rate-limits'
  | 'demo-setup'
  | 'demo-instructions'
  | 'session-recorder'
  | 'connecting'

interface StepMeta {
  title: string
  description: string
  shortLabel: string
  sidebarGroup?: string
  hideFromSidebar?: boolean
  // Whether this step belongs to the user's flow at all (vs. skipped because
  // completed). Used by the sidebar to hide non-applicable branches like the
  // demo flow on a custom project, or the SDK setup on a demo project.
  applicable?: (c: Partial<AgentConfig>) => boolean
  canSkip: (c: Partial<AgentConfig>) => boolean
}

const STEP_DEFS: Record<StepId, StepMeta> = {
  'project-type': {
    title: 'Setup a project',
    description: 'Choose how you want to get started with Multiplayer.',
    shortLabel: 'Project',
    canSkip: (c) => !!c.dir,
  },
  'account-select': {
    title: 'Select Account',
    description: 'Link this project to an existing Multiplayer account or add a new one.',
    shortLabel: 'Account',
    sidebarGroup: 'auth',
    canSkip: (c) => listAccounts().length === 0 || (!!c.apiKey && !!c.workspace && !!c.project),
  },
  'auth-method': {
    title: 'Authentication',
    description: 'Choose how to authenticate with Multiplayer.',
    shortLabel: 'Auth',
    sidebarGroup: 'auth',
    canSkip: (c) => !!c.apiKey,
  },
  'project-select': {
    title: 'Select Project',
    description: 'Choose the project this agent will monitor.',
    shortLabel: 'Project',
    sidebarGroup: 'auth',
    canSkip: (c) => {
      if (c.authType === 'oauth' && !(c.workspace && c.project)) return false
      return !!(c.workspace && c.project)
    },
  },
  workspace: {
    title: 'Workspace Confirmation',
    description: 'Review the workspace and project that will receive agent updates.',
    shortLabel: 'Workspace',
    sidebarGroup: 'auth',
    canSkip: (c) => !!(c.workspace && c.project && c.apiKey),
  },
  directory: {
    title: 'Repository Directory',
    description: 'Select the git repository where patches, commits, and branches are created.',
    shortLabel: 'Directory',
    canSkip: (c) => !!c.dir,
  },
  model: {
    title: 'AI Model',
    description: 'Choose an AI provider and model for issue resolution.',
    shortLabel: 'Model',
    canSkip: (c) => !!(c.model && (c.model.startsWith('claude') || c.modelKey)),
  },
  'rate-limits': {
    title: 'Concurrency',
    description: 'Set how many issues can be processed in parallel.',
    shortLabel: 'Concurrency',
    canSkip: (c) => !!c.isDemoProject || typeof c.maxConcurrentIssues === 'number',
  },
  'demo-setup': {
    title: 'Preparing Demo App',
    description: 'Configure the cloned demo app before showing run instructions.',
    shortLabel: 'Prepare Demo',
    hideFromSidebar: true,
    applicable: (c) => !!c.isDemoProject,
    canSkip: (c) => !c.isDemoProject || !!c.demoSetupDone,
  },
  'demo-instructions': {
    title: 'Run Demo App',
    description: 'Review the commands for starting the example client and server.',
    shortLabel: 'Run Demo',
    applicable: (c) => !!c.isDemoProject,
    canSkip: (c) => !c.isDemoProject || !!c.demoInstructionsDone,
  },
  'session-recorder': {
    title: 'Session Recorder',
    description: 'Detect your app stack and set up the Multiplayer Session Recorder SDK.',
    shortLabel: 'Multiplayer SDK',
    applicable: (c) => !c.isDemoProject && !process.env.MULTIPLAYER_SKIP_SR_SETUP,
    canSkip: (c) => !!c.isDemoProject || !!c.sessionRecorderSetupDone || !!process.env.MULTIPLAYER_SKIP_SR_SETUP,
  },
  connecting: {
    title: 'Final Checks',
    description: 'Verify git and provider requirements before starting runtime.',
    shortLabel: 'Verify',
    canSkip: () => false,
  },
}

const STEPS = Object.keys(STEP_DEFS) as StepId[]

// ─── Route map ────────────────────────────────────────────────────────────────

function prevStep(current: StepId, config: Partial<AgentConfig>): StepId | null {
  switch (current) {
    case 'project-type':
      return null
    case 'account-select':
      return 'project-type'
    case 'auth-method':
      return listAccounts().length > 0 ? 'account-select' : 'project-type'
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
      return config.isDemoProject ? 'demo-instructions' : 'rate-limits'
    case 'demo-instructions':
      return 'model'
    case 'demo-setup':
      return 'model'
    case 'connecting':
      return config.isDemoProject ? 'demo-instructions' : 'session-recorder'
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

export function StartupScreen({
  initialConfig,
  profileName,
  authErrorMessage,
  onComplete,
}: Props): ReactElement | null {
  const [config, setConfig] = useState<Partial<AgentConfig>>(initialConfig)
  const [step, setStep] = useState<StepId>(() => firstRequiredStep(initialConfig))
  const [ready, setReady] = useState(false)
  const [oauthWorkspaces, setOauthWorkspaces] = useState<SelectableWorkspace[]>([])
  const [fetchingWorkspaces, setFetchingWorkspaces] = useState(false)
  const demoAutoCreationStartedRef = useRef(false)
  const [oauthApi, setOauthApi] = useState<ReturnType<typeof createApiService> | null>(null)
  const { width: termWidth, height: termHeight } = useTerminalDimensions()

  // ── Navigation ────────────────────────────────────────────────────────────

  const [account, setAccount] = useState(profileName ?? 'default')

  const advance = useCallback(
    (updates: Partial<AgentConfig>, accountOverride?: string) => {
      const effectiveAccount = accountOverride ?? account
      const next = { ...config, ...updates }
      setConfig(next)

      // Credentials (auth only) → ~/.multiplayer/credentials.json
      const creds: Parameters<typeof writeCredentials>[1] = {}
      if (next.authType !== 'oauth' && next.apiKey) creds.apiKey = next.apiKey
      if (next.authType) creds.authType = next.authType
      if (next.url) creds.url = next.url
      if (Object.keys(creds).length > 0) writeCredentials(effectiveAccount, creds)

      // Project settings → <dir>/.multiplayer/settings.json
      if (next.dir) {
        addProject(next.dir, effectiveAccount)
        if (next.isDemoProject) setProjectDemo(next.dir, true)
        writeProjectSettings(next.dir, {
          workspace: next.workspace,
          project: next.project,
          model: next.model,
          modelKey: next.modelKey,
          modelUrl: next.modelUrl,
          maxConcurrentIssues: next.maxConcurrentIssues,
          sessionRecorderSetupDone: next.sessionRecorderSetupDone,
          sessionRecorderStacks: next.sessionRecorderStacks,
          ...(next.isDemoProject ? seedDemoGitIfUnset(next.dir) : {}),
        })
      }

      setStep(nextStep(step, next))
    },
    [config, step, account],
  )

  const handleAuthComplete = useCallback(
    (updates: Partial<AgentConfig> & { _oauthWorkspaces?: SelectableWorkspace[]; _accountName?: string }) => {
      if (updates._accountName) setAccount(updates._accountName)

      if (updates._oauthWorkspaces) {
        const workspaces = updates._oauthWorkspaces
        setOauthWorkspaces(workspaces)
        const next = {
          ...config,
          apiKey: updates.apiKey,
          authType: updates.authType,
          ...(updates.url ? { url: updates.url } : {}),
        }
        setConfig(next)
        const resolvedUrl = next.url || API_URL
        setOauthApi(createApiService({ url: resolvedUrl, apiKey: '', bearerToken: updates.apiKey! }))
        setStep('project-select')
      } else {
        advance(updates, updates._accountName)
      }
    },
    [config, advance],
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
            projects: (await api.fetchProjects(ws._id)).filter((p) => !!p._id && !!p.name),
          })),
        )
        writeCredentials(account, { authType: 'oauth' })

        if (config.isDemoProject && workspaces.length === 1) {
          const ws = workspaces[0]!
          const projectName = findUniqueDemoProjectName(ws.projects)
          const proj = await api.createProject(ws._id, projectName)
          const next: Partial<AgentConfig> = {
            ...config,
            authType: 'oauth',
            workspace: ws._id,
            project: proj._id,
            workspaceDisplayName: ws.name,
            projectDisplayName: proj.name,
          }
          setConfig(next)
          if (next.dir) {
            addProject(next.dir, account)
            if (next.isDemoProject) setProjectDemo(next.dir, true)
            writeProjectSettings(next.dir, {
              workspace: next.workspace,
              project: next.project,
              model: next.model,
              modelKey: next.modelKey,
              modelUrl: next.modelUrl,
              maxConcurrentIssues: next.maxConcurrentIssues,
              sessionRecorderSetupDone: next.sessionRecorderSetupDone,
              ...(next.isDemoProject ? seedDemoGitIfUnset(next.dir) : {}),
            })
          }
          setStep(nextStep('project-select', next))
        } else {
          setConfig((c) => ({ ...c, authType: 'oauth' }))
          setOauthWorkspaces(workspaces)
        }
      })
      .catch(() => {
        /* empty list handled by ProjectSelectStep */
      })
      .finally(() => setFetchingWorkspaces(false))
  }, [step])

  // OAuth path: demo + single workspace → auto-create project and skip selection
  useEffect(() => {
    if (
      step !== 'project-select' ||
      !config.isDemoProject ||
      oauthWorkspaces.length !== 1 ||
      !oauthApi ||
      demoAutoCreationStartedRef.current
    ) return

    demoAutoCreationStartedRef.current = true
    const ws = oauthWorkspaces[0]!
    const projectName = findUniqueDemoProjectName(ws.projects)
    setFetchingWorkspaces(true)
    void oauthApi
      .createProject(ws._id, projectName)
      .then((proj) => {
        writeCredentials(account, { authType: 'oauth' })
        const next: Partial<AgentConfig> = {
          ...config,
          workspace: ws._id,
          project: proj._id,
          workspaceDisplayName: ws.name,
          projectDisplayName: proj.name,
        }
        setConfig(next)
        if (next.dir) {
          addProject(next.dir, account)
          writeProjectSettings(next.dir, {
            workspace: next.workspace,
            project: next.project,
            model: next.model,
            modelKey: next.modelKey,
            modelUrl: next.modelUrl,
            maxConcurrentIssues: next.maxConcurrentIssues,
            sessionRecorderSetupDone: next.sessionRecorderSetupDone,
          })
        }
        setStep(nextStep('project-select', next))
      })
      .catch(() => {
        demoAutoCreationStartedRef.current = false
        setFetchingWorkspaces(false)
      })
  }, [step, oauthWorkspaces, oauthApi])

  useLayoutEffect(() => {
    // eslint-disable-next-line no-console
    console.clear()
    setReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    // eslint-disable-next-line no-console
    console.clear()
  }, [ready, step])

  useEffect(() => {
    const onResize = () => {
      // eslint-disable-next-line no-console
      console.clear()
    }
    process.stdout.on('resize', onResize)
    return () => {
      process.stdout.off('resize', onResize)
    }
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
      } catch {
        /* non-fatal */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [config.apiKey, config.workspace, config.project, config.url])

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const currentStepIndex = STEPS.indexOf(step)
  const visibleSteps = STEPS.filter((s, i) => {
    const def = STEP_DEFS[s]
    if (def.hideFromSidebar) return false
    if (def.applicable && !def.applicable(config)) return false
    return i <= currentStepIndex || !def.canSkip(config) || s === 'connecting'
  })
  // If the current step is hidden from the sidebar (e.g. demo-setup), attribute
  // it to the next visible step so progress and the active marker don't reset.
  let effectiveStep: StepId = step
  if (!visibleSteps.includes(step)) {
    for (let i = currentStepIndex + 1; i < STEPS.length; i++) {
      if (visibleSteps.includes(STEPS[i]!)) {
        effectiveStep = STEPS[i]!
        break
      }
    }
  }
  const currentVisibleIndex = visibleSteps.indexOf(effectiveStep)

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
      const anyGroupCurrent = visibleSteps.some(
        (vs) => STEP_DEFS[vs].sidebarGroup === group && vs === effectiveStep,
      )
      sidebarSteps.push({
        id: `group-${group}`,
        label: 'Auth',
        isDone: lastGroupIdx < currentVisibleIndex,
        isCurrent: anyGroupCurrent,
      })
    } else {
      const i = visibleSteps.indexOf(s)
      sidebarSteps.push({
        id: s,
        label: def.shortLabel,
        isDone: i < currentVisibleIndex,
        isCurrent: s === effectiveStep,
      })
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
    ? config.dir.length > 30
      ? `${config.dir.slice(0, 14)}…${config.dir.slice(-14)}`
      : config.dir
    : '—'
  const setupWorkspaceLabel = compactContextLabel(config.workspaceDisplayName, config.workspace)
  const setupProjectLabel = compactContextLabel(config.projectDisplayName, config.project)

  if (!ready) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <box flexDirection='column' width={termWidth} height={termHeight} padding={1} overflow={'hidden' as const}>
      <Logo />
      <box flexDirection='row' gap={1} alignItems='stretch' flexGrow={1} flexShrink={1} overflow={'hidden' as const}>
        {/* Left sidebar */}
        <box width={STEP_PANEL_WIDTH} flexShrink={0} flexDirection='column' overflow={'hidden' as const}>
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
        <box flexDirection='column' flexGrow={1} flexShrink={1} overflow={'hidden' as const}>
          <box flexDirection='column' flexShrink={0} marginBottom={1}>
            <text attributes={tuiAttrs({ bold: true })}>{label.title}</text>
            <text attributes={tuiAttrs({ dim: true })}>{label.description}</text>
            {authErrorMessage && step === 'auth-method' && (
              <text fg='#f87171'>Session expired or unauthorized — please sign in again.</text>
            )}
          </box>

          {step !== 'project-type' && (
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
          )}

          <box flexDirection='column' flexGrow={1} flexShrink={1} overflow={'hidden' as const}>
            {step === 'project-type' && <ProjectTypeStep onComplete={(updates) => handleAuthComplete(updates)} />}
            {step === 'account-select' && (
              <AccountSelectStep
                url={config.url || API_URL}
                onComplete={(updates) => handleAuthComplete(updates)}
                onAddNew={() => setStep('auth-method')}
                onBack={goBack}
              />
            )}
            {step === 'auth-method' && (
              <AuthMethodStep
                config={config}
                url={config.url || API_URL}
                profileName={profileName}
                onComplete={(updates) => handleAuthComplete(updates)}
                onBack={goBack}
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
                  oauthApi ? async (workspaceId, name) => oauthApi.createProject(workspaceId, name) : undefined
                }
              />
            )}
            {step === 'workspace' && <WorkspaceStep config={config} onComplete={advance} />}
            {step === 'directory' && <DirectoryStep config={config} onComplete={advance} />}
            {step === 'model' && <ModelStep config={config} onComplete={advance} />}
            {step === 'rate-limits' && <RateLimitsStep config={config} onComplete={advance} />}
            {step === 'demo-setup' && <DemoSetupStep config={config} onComplete={advance} onBack={goBack} />}
            {step === 'demo-instructions' && (
              <DemoInstructionsStep config={config} onComplete={advance} onBack={goBack} />
            )}
            {step === 'session-recorder' && <MultiplayerSdkStep config={config} onComplete={advance} onBack={goBack} />}
            {step === 'connecting' && (
              <ConnectingStep config={config as AgentConfig} onComplete={onComplete} onBack={goBack} />
            )}
          </box>
        </box>
      </box>
    </box>
  ) as ReactElement
}
