import { useState, useCallback, useEffect, useLayoutEffect, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { createApiService } from '../../services/api.service.js'
import { API_URL } from '../../config.js'
import { Logo } from '../Logo.js'
import { ApiKeyStep } from '../startup/ApiKeyStep.js'
import { WorkspaceStep } from '../startup/WorkspaceStep.js'
import { DirectoryStep } from '../startup/DirectoryStep.js'
import { ModelStep } from '../startup/ModelStep.js'
import { RateLimitsStep } from '../startup/RateLimitsStep.js'
import { ConnectingStep } from '../startup/ConnectingStep.js'

type StepId = 'api-key' | 'workspace' | 'directory' | 'model' | 'rate-limits' | 'connecting'

const STEPS: StepId[] = ['api-key', 'workspace', 'directory', 'model', 'rate-limits', 'connecting']

const STEP_LABELS: Record<StepId, { title: string; description: string }> = {
  'api-key': {
    title: 'Project API Key',
    description: 'Authenticate with Multiplayer and load workspace/project context.'
  },
  workspace: {
    title: 'Workspace Confirmation',
    description: 'Review the workspace and project that will receive agent updates.'
  },
  directory: {
    title: 'Repository Directory',
    description: 'Select the git repository where patches, commits, and branches are created.'
  },
  model: { title: 'AI Model', description: 'Choose an AI provider and model for issue resolution.' },
  'rate-limits': { title: 'Concurrency', description: 'Set how many issues can be processed in parallel.' },
  connecting: { title: 'Final Checks', description: 'Verify git and provider requirements before starting runtime.' }
}

const STEP_SHORT: Record<StepId, string> = {
  'api-key': 'API key',
  workspace: 'Workspace',
  directory: 'Directory',
  model: 'Model',
  'rate-limits': 'Concurrency',
  connecting: 'Verify'
}

const STEP_PANEL_WIDTH = 24

function compactContextLabel(name: string | undefined, id: string | undefined): string {
  const raw = (name?.trim() || id || '—').trim()
  if (raw === '—') return raw
  return raw.length > 26 ? `${raw.slice(0, 12)}…${raw.slice(-11)}` : raw
}

function canSkip(step: StepId, config: Partial<AgentConfig>): boolean {
  switch (step) {
    case 'api-key':
      return !!config.apiKey
    case 'workspace':
      return !!(config.workspace && config.project && config.apiKey)
    case 'directory':
      return !!config.dir
    case 'model':
      return !!(config.model && (config.model.startsWith('claude') || config.modelKey))
    case 'rate-limits':
      return typeof config.maxConcurrentIssues === 'number'
    case 'connecting':
      return false
  }
}

function firstRequiredStep(config: Partial<AgentConfig>): StepId {
  for (const step of STEPS) {
    if (!canSkip(step, config)) return step
  }
  return 'connecting'
}

interface Props {
  initialConfig: Partial<AgentConfig>
  profileName?: string
  onComplete: (config: AgentConfig) => void
}

export function StartupScreen({ initialConfig, profileName, onComplete }: Props): ReactElement | null {
  const [config, setConfig] = useState<Partial<AgentConfig>>(initialConfig)
  const [step, setStep] = useState<StepId>(() => firstRequiredStep(initialConfig))
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    console.clear()
    setReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    console.clear()
  }, [ready, step])

  useEffect(() => {
    const onResize = () => {
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
            ...(projectDisplayName ? { projectDisplayName } : {})
          }
        })
      } catch {
        // non-fatal — keep showing ids
      }
    })()

    return () => {
      cancelled = true
    }
  }, [config.apiKey, config.workspace, config.project, config.url])

  const advance = useCallback(
    (updates: Partial<AgentConfig>) => {
      const next = { ...config, ...updates }
      setConfig(next)
      const currentIdx = STEPS.indexOf(step)
      for (let i = currentIdx + 1; i < STEPS.length; i++) {
        const nextStep = STEPS[i]!
        if (!canSkip(nextStep, next)) {
          setStep(nextStep)
          return
        }
      }
      setStep('connecting')
    },
    [config, step]
  )

  /** Previous wizard screen (linear). Do not skip “already filled” steps — Esc from model must reach directory. */
  const goBack = useCallback(() => {
    const currentIdx = STEPS.indexOf(step)
    if (currentIdx <= 0) return
    setStep(STEPS[currentIdx - 1]!)
  }, [step])

  useKeyboard(({ name }) => {
    if (name !== 'escape' || step === 'api-key') return
    goBack()
  })

  const currentStepIndex = STEPS.indexOf(step)
  const visibleSteps = STEPS.filter((s, i) => i <= currentStepIndex || !canSkip(s, config) || s === 'connecting')
  const currentVisibleIndex = visibleSteps.indexOf(step)
  const label = STEP_LABELS[step]
  const done = Math.max(0, currentVisibleIndex)
  const total = Math.max(1, visibleSteps.length)
  const progressPrefix = `${currentVisibleIndex + 1}/${visibleSteps.length}`
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

  return (
    <box flexDirection='column' padding={1}>
      <Logo />
      <box flexDirection='row' gap={1} alignItems='stretch'>
        {/* Left sidebar: step progress */}
        <box width={STEP_PANEL_WIDTH} flexDirection='column'>
          <text attributes={tuiAttrs({ bold: true })}>Setup Steps</text>
          {visibleSteps.map((s, i) => {
            const isCurrent = s === step
            const isDone = i < currentVisibleIndex
            const marker = isDone ? '✓' : isCurrent ? '❯' : '·'
            const color = isDone ? '#10b981' : isCurrent ? '#22d3ee' : '#6b7280'
            return (
              <text key={s} fg={color} attributes={tuiAttrs({ bold: isCurrent })}>
                {marker} {STEP_SHORT[s]}
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
              Profile {profileName ?? 'default'} · Enter confirm · Esc back · Ctrl+C quit
            </text>
          </box>

          {step === 'api-key' && <ApiKeyStep config={config} onComplete={advance} />}
          {step === 'workspace' && <WorkspaceStep config={config} onComplete={advance} />}
          {step === 'directory' && <DirectoryStep config={config} onComplete={advance} />}
          {step === 'model' && <ModelStep config={config} onComplete={advance} />}
          {step === 'rate-limits' && <RateLimitsStep config={config} onComplete={advance} />}
          {step === 'connecting' && (
            <ConnectingStep config={config as AgentConfig} onComplete={onComplete} onBack={goBack} />
          )}
        </box>
      </box>
    </box>
  ) as ReactElement
}
