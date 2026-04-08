import { useState, type ReactElement } from 'react'
import { stringFromInputSubmit, type InputSubmitPayload } from '../lib/inputSubmit.js'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import * as fs from 'fs'
import * as path from 'path'
import { AgentConfig } from '../types/index.js'
import { validateApiKey } from '../services/radar.service.js'

interface Field {
  key: keyof AgentConfig
  label: string
  placeholder: string
  secret?: boolean
}

const FIELDS: Field[] = [
  { key: 'apiKey', label: 'Project API key', placeholder: 'eyJ...', secret: true },
  { key: 'dir', label: 'Project directory', placeholder: process.cwd() },
  { key: 'model', label: 'AI model', placeholder: 'claude-sonnet-4-6 or gpt-4o' },
  { key: 'modelKey', label: 'AI API key', placeholder: 'sk-...', secret: true },
  { key: 'modelUrl', label: 'AI base URL (optional)', placeholder: 'leave empty for default' },
]

const isClaudeModel = (model?: string): boolean => !!(model?.startsWith('claude'))

const MODEL_OPTIONS = [
  { label: 'claude-sonnet-4-6', value: 'claude-sonnet-4-6' },
  { label: 'claude-opus-4-6', value: 'claude-opus-4-6' },
  { label: 'claude-haiku-4-5-20251001', value: 'claude-haiku-4-5-20251001' },
  { label: 'gpt-4o', value: 'gpt-4o' },
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'Custom...', value: '__custom__' },
]

function readDirs(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

const CONFIRM_ITEM = '__confirm__'
const UP_ITEM = '__up__'

interface DirSelectProps {
  onSelect: (value: string) => void
}

function DirSelect({ onSelect }: DirSelectProps): ReactElement {
  const [currentPath, setCurrentPath] = useState(process.cwd())
  const [selectedIndex, setSelectedIndex] = useState(0)

  const subdirs = readDirs(currentPath)
  const isRoot = currentPath === path.parse(currentPath).root
  const items = [CONFIRM_ITEM, ...(isRoot ? [] : [UP_ITEM]), ...subdirs]

  useKeyboard(({ name }) => {
    if (name === 'up') {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (name === 'down') {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
    } else if (name === 'return') {
      const item = items[selectedIndex]
      if (!item) return
      if (item === CONFIRM_ITEM) {
        onSelect(currentPath)
      } else if (item === UP_ITEM) {
        setCurrentPath(path.dirname(currentPath))
        setSelectedIndex(0)
      } else {
        setCurrentPath(path.join(currentPath, item))
        setSelectedIndex(0)
      }
    }
  })

  return (
    <box flexDirection="column">
      <box marginBottom={1}>
        <text attributes={tuiAttrs({ dim: true })}>{currentPath}</text>
      </box>
      {items.map((item, i) => {
        const isActive = i === selectedIndex
        let label: string
        let color: string | undefined
        if (item === CONFIRM_ITEM) {
          label = 'Use this directory'
          color = isActive ? '#10b981' : undefined
        } else if (item === UP_ITEM) {
          label = '../'
          color = isActive ? '#22d3ee' : undefined
        } else {
          label = `${item}/`
          color = isActive ? '#22d3ee' : undefined
        }
        return (
          <box key={item}>
            <text fg={color} attributes={tuiAttrs({ bold: isActive })}>
              {isActive ? '❯ ' : '  '}{label}
            </text>
          </box>
        )
      })}
      <box marginTop={1}>
        <text attributes={tuiAttrs({ dim: true })}>↑↓ navigate · Enter confirm/open</text>
      </box>
    </box>
  ) as ReactElement
}

interface ModelSelectProps {
  onSelect: (value: string) => void
}

function ModelSelect({ onSelect }: ModelSelectProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')

  useKeyboard(({ name }) => {
    if (customMode) return
    if (name === 'up') {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (name === 'down') {
      setSelectedIndex((i) => Math.min(MODEL_OPTIONS.length - 1, i + 1))
    } else if (name === 'return') {
      const option = MODEL_OPTIONS[selectedIndex]
      if (!option) return
      if (option.value === '__custom__') setCustomMode(true)
      else onSelect(option.value)
    }
  })

  if (customMode) {
    return (
      <box flexDirection="row" gap={1}>
        <text fg="#f59e0b">❯</text>
        <input
          width={40}
          value={customValue}
          onInput={setCustomValue}
          onSubmit={(p) => {
            const t = stringFromInputSubmit(p, customValue).trim()
            if (t) onSelect(t)
          }}
          placeholder="Enter model name"
        />
      </box>
    ) as ReactElement
  }

  return (
    <box flexDirection="column">
      {MODEL_OPTIONS.map((option, i) => {
        const isActive = i === selectedIndex
        return (
          <box key={option.value}>
            <text fg={isActive ? '#22d3ee' : undefined} attributes={tuiAttrs({ bold: isActive })}>
              {isActive ? '❯ ' : '  '}{option.label}
            </text>
          </box>
        )
      })}
      <box marginTop={1}>
        <text attributes={tuiAttrs({ dim: true })}>↑↓ navigate · Enter select</text>
      </box>
    </box>
  ) as ReactElement
}

interface Props {
  initial: Partial<AgentConfig>
  onComplete: (config: AgentConfig) => void
}

export function ConfigForm({ initial, onComplete }: Props): ReactElement | null {
  const missing = FIELDS.filter((f) => {
    if (f.key === 'modelUrl') return false
    if (f.key === 'modelKey' && isClaudeModel(initial.model)) return false
    return !initial[f.key]
  })

  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Partial<AgentConfig>>(initial)
  const [currentInput, setCurrentInput] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  if (missing.length === 0) {
    onComplete(initial as AgentConfig)
    return null
  }

  const currentField = missing[step]
  if (!currentField) return null

  const advance = (value: string | undefined, extra?: Partial<AgentConfig>) => {
    const updated = { ...values, [currentField.key]: value, ...extra }
    setValues(updated)
    setCurrentInput('')
    setValidationError(null)

    let nextStep = step + 1
    if (currentField.key === 'model' && isClaudeModel(value) && missing[nextStep]?.key === 'modelKey') {
      nextStep++
    }

    if (nextStep >= missing.length) onComplete(updated as AgentConfig)
    else setStep(nextStep)
  }

  const handleSubmit = (payload: InputSubmitPayload) => {
    const value = stringFromInputSubmit(payload, currentInput)
    const trimmed = value.trim()
    if (!trimmed && currentField.key !== 'modelUrl') return

    if (currentField.key === 'apiKey') {
      const url = (values.url || initial.url || '') as string
      setValidating(true)
      setValidationError(null)
      validateApiKey(url, trimmed)
        .then(({ workspace, project }) => { setValidating(false); advance(trimmed, { workspace, project }) })
        .catch((err: Error) => { setValidating(false); setValidationError(err.message) })
      return
    }

    advance(trimmed || undefined)
  }

  return (
    <box flexDirection="column" padding={1}>
      <box marginBottom={1}>
        <text attributes={tuiAttrs({ dim: true })}>
          Step {step + 1}/{missing.length}: {currentField.label}
        </text>
      </box>

      {validationError && (
        <box marginBottom={1}>
          <text fg="#ef4444">✗ {validationError}</text>
        </box>
      )}

      {currentField.key === 'dir' ? (
        <DirSelect onSelect={(v) => advance(v)} />
      ) : currentField.key === 'model' ? (
        <ModelSelect onSelect={(v) => advance(v)} />
      ) : validating ? (
        <text fg="#f59e0b">◌ Validating API key...</text>
      ) : (
        <box flexDirection="row" gap={1}>
          <text fg="#f59e0b">❯</text>
          <input
            width={50}
            value={currentInput}
            onInput={setCurrentInput}
            onSubmit={handleSubmit}
            placeholder={currentField.placeholder}
          />
        </box>
      )}
    </box>
  ) as ReactElement
}
