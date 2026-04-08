import { useState, useEffect, type ReactElement } from 'react'
import type { KeyEvent, MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import { InputSubmitPayload, stringFromInputSubmit } from '../../lib/inputSubmit.js'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import * as AiService from '../../services/ai.service.js'
import type { AgentConfig } from '../../types/index.js'

function clickHandler(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}

interface ModelOption {
  label: string
  value: string
  provider: 'claude' | 'openai'
  description?: string
}

const CLAUDE_MODELS: ModelOption[] = [
  { label: 'claude-sonnet-4-6', value: 'claude-sonnet-4-6', provider: 'claude', description: 'Fast, capable' },
  { label: 'claude-opus-4-6', value: 'claude-opus-4-6', provider: 'claude', description: 'Most powerful' },
  { label: 'claude-haiku-4-5', value: 'claude-haiku-4-5-20251001', provider: 'claude', description: 'Fastest' },
]

const OPENAI_MODELS: ModelOption[] = [
  { label: 'gpt-4o', value: 'gpt-4o', provider: 'openai' },
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini', provider: 'openai', description: 'Faster, cheaper' },
]

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

type SubStep = 'detecting' | 'select' | 'api-key' | 'custom-model' | 'api-url'

export function ModelStep({ config, onComplete }: Props): ReactElement | null {
  const [subStep, setSubStep] = useState<SubStep>('detecting')
  const [claudeAvailable, setClaudeAvailable] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const [options, setOptions] = useState<ModelOption[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null)
  const [apiKey, setApiKey] = useState(config.modelKey ?? '')
  const [apiUrl, setApiUrl] = useState(config.modelUrl ?? '')
  const [customModelName, setCustomModelName] = useState('')
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [customModelError, setCustomModelError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    AiService.checkClaudeRequirements()
      .then(() => {
        setClaudeAvailable(true)
        setOptions([
          ...CLAUDE_MODELS,
          ...OPENAI_MODELS,
          { label: 'Custom OpenAI-compatible...', value: '__custom__', provider: 'openai' },
        ])
        setSubStep('select')
      })
      .catch(() => {
        setClaudeAvailable(false)
        setOptions([
          ...OPENAI_MODELS,
          { label: 'Custom OpenAI-compatible...', value: '__custom__', provider: 'openai' },
        ])
        setDetectError('Claude CLI not found — Claude models unavailable')
        setSubStep('select')
      })
  }, [])

  const selectModel = (opt: ModelOption) => {
    setSelectedModel(opt)
    if (opt.provider === 'openai') {
      if (!config.modelKey) {
        setSubStep('api-key')
        return
      }
      if (opt.value === '__custom__') {
        setCustomModelName(config.model && !config.model.startsWith('claude') ? config.model : '')
        setSubStep('custom-model')
      } else {
        setSubStep('api-url')
      }
    } else {
      onComplete({ model: opt.value, modelKey: '', modelUrl: undefined })
    }
  }

  useKeyboard((key: KeyEvent) => {
    const { name } = key
    // Navigation in select mode
    if (subStep === 'select') {
      if (name === 'up') {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down') {
        setSelectedIndex((i) => Math.min(options.length - 1, i + 1))
      } else if (name === 'return') {
        const opt = options[selectedIndex]
        if (opt) selectModel(opt)
      }
    }

    // Back navigation from sub-steps (consume Esc so StartupScreen does not jump to directory)
    if (name === 'escape' && (subStep === 'api-key' || subStep === 'custom-model' || subStep === 'api-url')) {
      setSubStep('select')
      key.stopPropagation()
    }
  })

  const handleApiKeySubmit = (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) {
      setApiKeyError('API key is required for this model')
      return
    }
    setValidating(true)
    setApiKeyError(null)
    AiService.checkOpenAiRequirements(trimmed, apiUrl || undefined)
      .then(() => {
        setValidating(false)
        setApiKey(trimmed)
        if (selectedModel?.value === '__custom__') {
          setCustomModelName(config.model && !config.model.startsWith('claude') ? config.model : '')
          setSubStep('custom-model')
        } else {
          setSubStep('api-url')
        }
      })
      .catch((err: Error) => {
        setValidating(false)
        setApiKeyError(err.message)
      })
  }

  const handleCustomModelSubmit = (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) {
      setCustomModelError('Model name is required')
      return
    }
    setCustomModelError(null)
    setCustomModelName(trimmed)
    setSubStep('api-url')
  }

  const handleApiUrlSubmit = (input: string) => {
    const trimmed = input.trim()
    const modelValue = selectedModel?.value === '__custom__' ? customModelName : (selectedModel?.value ?? '')
    onComplete({ model: modelValue, modelKey: apiKey || config.modelKey, modelUrl: trimmed || undefined })
  }

  if (subStep === 'detecting') {
    return (
      <box flexDirection='column' gap={1}>
        <text fg='#f59e0b'>◌ Detecting available providers...</text>
      </box>
    ) as ReactElement
  }

  if (subStep === 'select') {
    return (
      <box flexDirection='column' flexGrow={1}>
        {detectError && <text fg='#f59e0b'> ⚠ {detectError}</text>}
        {claudeAvailable && <text fg='#10b981'> ✓ Claude CLI detected</text>}
        <text attributes={tuiAttrs({ dim: true })} marginLeft={1}>
          Use Claude for fastest local setup, or OpenAI-compatible with API key.
        </text>
        <box
          flexDirection='column'
          marginTop={1}
          border={true}
          borderStyle='rounded'
          borderColor='#30363d'
          flexGrow={1}
          overflow={'hidden' as const}
        >
          {options.map((opt, i) => {
            const isActive = i === selectedIndex
            const isHovered = hoveredRow === i
            const isClaudeOption = opt.provider === 'claude'
            const isLast = i === options.length - 1
            const icon = isClaudeOption ? '◆' : opt.value === '__custom__' ? '⚙' : '◇'
            const iconColor = isClaudeOption ? '#22d3ee' : '#f59e0b'
            const nameFg = isActive ? '#e6edf3' : isClaudeOption ? '#c9d1d9' : '#f59e0b'

            return (
              <box
                key={opt.value}
                flexDirection='column'
                onMouseUp={clickHandler(() => selectModel(opt))}
                onMouseOver={() => setHoveredRow(i)}
                onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
              >
                <box
                  flexDirection='row'
                  height={1}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
                >
                  <box width={3} flexShrink={0}>
                    <text fg={iconColor}>{icon}</text>
                  </box>
                  <box flexGrow={1}>
                    <text fg={nameFg} attributes={tuiAttrs({ bold: isActive })}>
                      {opt.label}
                    </text>
                  </box>
                  {opt.description && (
                    <box flexShrink={0}>
                      <text attributes={tuiAttrs({ dim: true })}>{opt.description}</text>
                    </box>
                  )}
                </box>
                {!isLast && (
                  <box height={1} paddingLeft={1} paddingRight={1}>
                    <text fg='#21262d'>{'─'.repeat(999)}</text>
                  </box>
                )}
              </box>
            )
          })}
        </box>
        <box flexDirection='row' flexShrink={0} paddingLeft={1} marginTop={1} gap={2}>
          <text fg='#484f58'>↑↓ navigate · Enter select · Click to select · Esc back</text>
        </box>
      </box>
    ) as ReactElement
  }

  if (subStep === 'api-key') {
    return (
      <box flexDirection='column' gap={1}>
        <text attributes={tuiAttrs({ dim: true })}>
          Enter your API key for <span fg='#22d3ee'>{selectedModel?.label}</span>
        </text>
        {apiKeyError && <text fg='#ef4444'>✗ {apiKeyError}</text>}
        {validating ? (
          <text fg='#f59e0b'>◌ Validating key...</text>
        ) : (
          <box border={true} borderStyle='rounded' borderColor='#22d3ee' padding={1} flexDirection='row' gap={1}>
            <text fg='#22d3ee'>❯</text>
            <input
              width={50}
              value={apiKey}
              onInput={setApiKey}
              onSubmit={(p: InputSubmitPayload) => handleApiKeySubmit(stringFromInputSubmit(p, apiKey))}
              placeholder='sk-...'
            />
          </box>
        )}
        <text attributes={tuiAttrs({ dim: true })}>Press Enter to confirm</text>
      </box>
    ) as ReactElement
  }

  if (subStep === 'api-url') {
    const isCustom = selectedModel?.value === '__custom__'
    return (
      <box flexDirection='column' gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>
          {isCustom ? 'Custom Endpoint (optional)' : 'API Base URL (optional)'}
        </text>
        <text attributes={tuiAttrs({ dim: true })}>
          {isCustom
            ? 'Enter a base URL for your OpenAI-compatible API, or leave empty to use the default endpoint.'
            : 'Leave empty to use the default OpenAI endpoint.'}
        </text>
        <box border={true} borderStyle='rounded' borderColor='#22d3ee' padding={1} flexDirection='row' gap={1}>
          <text fg='#22d3ee'>❯</text>
          <input
            width={50}
            value={apiUrl}
            onInput={setApiUrl}
            onSubmit={(p: InputSubmitPayload) => handleApiUrlSubmit(stringFromInputSubmit(p, apiUrl))}
            placeholder='leave empty for default'
          />
        </box>
        <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
      </box>
    ) as ReactElement
  }

  if (subStep === 'custom-model') {
    return (
      <box flexDirection='column' gap={1}>
        <text attributes={tuiAttrs({ dim: true })}>Enter the model identifier exposed by your provider.</text>
        {customModelError && <text fg='#ef4444'>✗ {customModelError}</text>}
        <box border={true} borderStyle='rounded' borderColor='#22d3ee' padding={1} flexDirection='row' gap={1}>
          <text fg='#22d3ee'>❯</text>
          <input
            width={50}
            value={customModelName}
            onInput={setCustomModelName}
            onSubmit={(p: InputSubmitPayload) => handleCustomModelSubmit(stringFromInputSubmit(p, customModelName))}
            placeholder='gpt-4.1-mini or provider-specific id'
          />
        </box>
        <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
      </box>
    ) as ReactElement
  }

  return null
}
