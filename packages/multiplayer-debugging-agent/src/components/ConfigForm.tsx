import { useState, type FC } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
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

interface DirSelectProps {
  onSelect: (value: string) => void
}

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

const DirSelect: FC<DirSelectProps> = ({ onSelect }) => {
  const [currentPath, setCurrentPath] = useState(process.cwd())
  const [selectedIndex, setSelectedIndex] = useState(0)

  const subdirs = readDirs(currentPath)
  const isRoot = currentPath === path.parse(currentPath).root
  const items = [
    CONFIRM_ITEM,
    ...(isRoot ? [] : [UP_ITEM]),
    ...subdirs,
  ]

  useInput((_, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
    } else if (key.return) {
      const item = items[selectedIndex]
      if (!item) return
      if (item === CONFIRM_ITEM) {
        onSelect(currentPath)
      } else if (item === UP_ITEM) {
        const parent = path.dirname(currentPath)
        setCurrentPath(parent)
        setSelectedIndex(0)
      } else {
        setCurrentPath(path.join(currentPath, item))
        setSelectedIndex(0)
      }
    }
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>{currentPath}</Text>
      </Box>
      {items.map((item, i) => {
        const isActive = i === selectedIndex
        let label: string
        let color: string | undefined
        if (item === CONFIRM_ITEM) {
          label = 'Use this directory'
          color = isActive ? 'green' : undefined
        } else if (item === UP_ITEM) {
          label = '../'
          color = isActive ? 'cyan' : undefined
        } else {
          label = `${item}/`
          color = isActive ? 'cyan' : undefined
        }
        return (
          <Box key={item}>
            <Text color={color} bold={isActive}>
              {isActive ? '> ' : '  '}
              {label}
            </Text>
          </Box>
        )
      })}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate · Enter confirm/open</Text>
      </Box>
    </Box>
  )
}

interface ModelSelectProps {
  onSelect: (value: string) => void
}

const ModelSelect: FC<ModelSelectProps> = ({ onSelect }: ModelSelectProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')

  useInput((_, key) => {
    if (customMode) return

    if (key.upArrow) {
      setSelectedIndex((i: number) => Math.max(0, i - 1))
    } else if (key.downArrow) {
      setSelectedIndex((i: number) => Math.min(MODEL_OPTIONS.length - 1, i + 1))
    } else if (key.return) {
      const option = MODEL_OPTIONS[selectedIndex]
      if (!option) return
      if (option.value === '__custom__') {
        setCustomMode(true)
      } else {
        onSelect(option.value)
      }
    }
  })

  if (customMode) {
    return (
      <Box>
        <Text color="yellow">{'> '}</Text>
        <TextInput
          value={customValue}
          onChange={setCustomValue}
          onSubmit={(v: string) => {
            const trimmed = v.trim()
            if (trimmed) onSelect(trimmed)
          }}
          placeholder="Enter model name"
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {MODEL_OPTIONS.map((option, i) => {
        const isActive = i === selectedIndex
        return (
          <Box key={option.value}>
            <Text color={isActive ? 'cyan' : undefined} bold={isActive}>
              {isActive ? '> ' : '  '}
              {option.label}
            </Text>
          </Box>
        )
      })}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate · Enter select</Text>
      </Box>
    </Box>
  )
}

interface Props {
  initial: Partial<AgentConfig>
  onComplete: (config: AgentConfig) => void
}

export const ConfigForm: FC<Props> = ({ initial, onComplete }) => {
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
    // Skip modelKey when a Claude model is selected (uses preinstalled agent)
    if (currentField.key === 'model' && isClaudeModel(value) && missing[nextStep]?.key === 'modelKey') {
      nextStep++
    }

    if (nextStep >= missing.length) {
      onComplete(updated as AgentConfig)
    } else {
      setStep(nextStep)
    }
  }

  const handleSubmit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed && currentField.key !== 'modelUrl') return

    if (currentField.key === 'apiKey') {
      const url = (values.url || initial.url || '') as string
      setValidating(true)
      setValidationError(null)
      validateApiKey(url, trimmed)
        .then(({ workspace, project }) => {
          setValidating(false)
          advance(trimmed, { workspace, project })
        })
        .catch((err: Error) => {
          setValidating(false)
          setValidationError(err.message)
        })
      return
    }

    advance(trimmed || undefined)
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text dimColor>
          Step {step + 1}/{missing.length}: {currentField.label}
        </Text>
      </Box>

      {validationError && (
        <Box marginBottom={1}>
          <Text color="red">✗ {validationError}</Text>
        </Box>
      )}

      {currentField.key === 'dir' ? (
        <DirSelect onSelect={(v: string) => advance(v)} />
      ) : currentField.key === 'model' ? (
        <ModelSelect onSelect={(v: string) => advance(v)} />
      ) : validating ? (
        <Text color="yellow">Validating API key...</Text>
      ) : (
        <Box>
          <Text color="yellow">{'> '}</Text>
          <TextInput
            value={currentInput}
            onChange={setCurrentInput}
            onSubmit={handleSubmit}
            placeholder={currentField.placeholder}
            mask={currentField.secret ? '*' : undefined}
          />
        </Box>
      )}
    </Box>
  )
}
