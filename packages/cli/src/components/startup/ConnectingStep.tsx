import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import * as AiService from '../../services/ai.service.js'
import * as GitService from '../../services/git.service.js'
import { validateApiKey } from '../../services/radar.service.js'
import { StatusIcon, FooterHints, SelectionList, type SelectionItem } from '../shared/index.js'

interface Props {
  config: AgentConfig
  onComplete: (config: AgentConfig) => void
  onBack?: () => void
}

type Status = 'checking-api-key' | 'checking-git' | 'checking-ai' | 'done' | 'error'
type CheckStep = 'api-key' | 'git' | 'ai'

const CHECK_STEPS: CheckStep[] = ['api-key', 'git', 'ai']

function getStepStatus(
  step: CheckStep,
  status: Status,
  failedStep: CheckStep | null
): 'loading' | 'success' | 'error' | 'idle' {
  const stepIdx = CHECK_STEPS.indexOf(step)

  if (status === 'done') return 'success'

  if (status === 'checking-api-key') {
    return step === 'api-key' ? 'loading' : 'idle'
  }
  if (status === 'checking-git') {
    if (step === 'api-key') return 'success'
    if (step === 'git') return 'loading'
    return 'idle'
  }
  if (status === 'checking-ai') {
    if (stepIdx < 2) return 'success'
    if (step === 'ai') return 'loading'
    return 'idle'
  }
  if (status === 'error' && failedStep) {
    const failedIdx = CHECK_STEPS.indexOf(failedStep)
    if (stepIdx < failedIdx) return 'success'
    if (stepIdx === failedIdx) return 'error'
    return 'idle'
  }

  return 'idle'
}

function CheckRow({
  stepStatus,
  label,
  hint
}: {
  stepStatus: 'loading' | 'success' | 'error' | 'idle'
  label: string
  hint?: string
}): ReactElement {
  return (
    <box flexDirection='row' alignItems='center' gap={1} flexShrink={0}>
      <box width={2} flexShrink={0}>
        <StatusIcon status={stepStatus} />
      </box>
      <text>{label}</text>
      {hint && <text attributes={tuiAttrs({ dim: true })}>{hint}</text>}
    </box>
  ) as ReactElement
}

function CheckStepBlock({
  stepStatus,
  label,
  hint,
  errorMessage
}: {
  stepStatus: 'loading' | 'success' | 'error' | 'idle'
  label: string
  hint?: string
  errorMessage?: string | null
}): ReactElement {
  return (
    <box flexDirection='column' gap={0} flexShrink={0}>
      <CheckRow stepStatus={stepStatus} label={label} hint={hint} />
      {errorMessage && (
        <box flexDirection='column' paddingLeft={3} gap={0}>
          {errorMessage.split('\n').map((line, i) => (
            <text key={i} fg='#ef4444'>
              {line || ' '}
            </text>
          ))}
        </box>
      )}
    </box>
  ) as ReactElement
}

export function ConnectingStep({ config, onComplete, onBack }: Props): ReactElement {
  const [status, setStatus] = useState<Status>('checking-api-key')
  const [failedStep, setFailedStep] = useState<CheckStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState(0)
  const [selectedAction, setSelectedAction] = useState(0)

  const actionItems = useMemo((): SelectionItem[] => {
    const items: SelectionItem[] = [
      { key: 'retry', icon: '↻', iconColor: '#10b981', label: 'Retry', labelColor: '#10b981' }
    ]
    if (onBack) {
      items.push({ key: 'back', icon: '←', iconColor: '#9ca3af', label: 'Back', labelColor: '#9ca3af' })
    }
    return items
  }, [onBack])

  const showAiRow = status !== 'checking-api-key' && status !== 'checking-git'
  const stepError = (step: CheckStep): string | null => (status === 'error' && failedStep === step ? error : null)

  const retry = () => {
    setError(null)
    setFailedStep(null)
    setSelectedAction(0)
    setStatus('checking-api-key')
    setRunId((v) => v + 1)
  }

  const activateAction = (index: number) => {
    const item = actionItems[index]
    if (!item) return
    if (item.key === 'retry') retry()
    else onBack?.()
  }

  useKeyboard(({ name }) => {
    if (status !== 'error') return
    if (name === 'up' || name === 'k') {
      setSelectedAction((s) => Math.max(0, s - 1))
      return
    }
    if (name === 'down' || name === 'j') {
      setSelectedAction((s) => Math.min(actionItems.length - 1, s + 1))
      return
    }
    if (name === 'return') {
      activateAction(selectedAction)
      return
    }
    if (name === 'escape') onBack?.()
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        if (cancelled) return
        setStatus('checking-api-key')
        setFailedStep(null)
        try {
          const { workspace, project } = await validateApiKey(config.url, config.apiKey)
          if (!config.workspace) config.workspace = workspace
          if (!config.project) config.project = project
        } catch (err: unknown) {
          setFailedStep('api-key')
          throw err
        }

        if (cancelled) return
        setStatus('checking-git')
        try {
          const isGit = await GitService.isGitRepo(config.dir)
          if (!isGit) throw new Error(`Not a git repository: ${config.dir}`)
        } catch (err: unknown) {
          setFailedStep('git')
          throw err
        }

        if (cancelled) return
        setStatus('checking-ai')
        try {
          const isClaudeModel = config.model === 'claude-code' || config.model.startsWith('claude')
          if (isClaudeModel) {
            await AiService.checkClaudeRequirements()
          } else {
            await AiService.checkOpenAiRequirements(config.modelKey, config.modelUrl)
          }
        } catch (err: unknown) {
          setFailedStep('ai')
          throw err
        }

        if (cancelled) return
        setStatus('done')
        await new Promise((r) => setTimeout(r, 400))
        if (cancelled) return
        onComplete(config)
      } catch (err: unknown) {
        if (cancelled) return
        setStatus('error')
        setSelectedAction(0)
        setError((err as Error).message)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [runId])

  return (
    <box flexDirection='column' gap={1} flexGrow={1} overflow={'hidden' as const}>
      <text attributes={tuiAttrs({ bold: true })}>Starting Agent</text>
      <box flexDirection='column' marginTop={1} gap={1} flexShrink={0}>
        <CheckStepBlock
          stepStatus={getStepStatus('api-key', status, failedStep)}
          label='API key'
          hint={status === 'checking-api-key' ? 'validating...' : undefined}
          errorMessage={stepError('api-key')}
        />
        <CheckStepBlock
          stepStatus={getStepStatus('git', status, failedStep)}
          label='Git repository'
          hint={status === 'checking-git' ? 'checking...' : undefined}
          errorMessage={stepError('git')}
        />
        {showAiRow && (
          <CheckStepBlock
            stepStatus={getStepStatus('ai', status, failedStep)}
            label='AI provider'
            hint={status === 'checking-ai' ? 'checking...' : undefined}
            errorMessage={stepError('ai')}
          />
        )}
        {status === 'done' && (
          <box flexDirection='row' alignItems='center' gap={1}>
            <box width={2} flexShrink={0}>
              <StatusIcon status='success' />
            </box>
            <text fg='#10b981'>All checks passed — connecting to Radar</text>
          </box>
        )}
      </box>
      {error && (
        <box flexDirection='column' gap={1} marginTop={1} flexShrink={0}>
          <SelectionList
            items={actionItems}
            selectedIndex={selectedAction}
            onSelect={(index) => {
              setSelectedAction(index)
              activateAction(index)
            }}
            scrollable={false}
            plain
          />
          <FooterHints hints='↑↓ navigate · Enter select · Esc back' />
        </box>
      )}
    </box>
  ) as ReactElement
}
