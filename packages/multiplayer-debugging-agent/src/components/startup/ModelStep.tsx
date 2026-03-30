import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import * as AiService from '../../services/ai.service.js'
import type { AgentConfig } from '../../types/index.js'

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

export const ModelStep: React.FC<Props> = ({ config, onComplete }) => {
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

  useEffect(() => {
    AiService.checkClaudeRequirements()
      .then(() => {
        setClaudeAvailable(true)
        const available: ModelOption[] = [
          ...CLAUDE_MODELS,
          ...OPENAI_MODELS,
          { label: 'Custom OpenAI-compatible...', value: '__custom__', provider: 'openai' },
        ]
        setOptions(available)
        setSubStep('select')
      })
      .catch(() => {
        setClaudeAvailable(false)
        const available: ModelOption[] = [
          ...OPENAI_MODELS,
          { label: 'Custom OpenAI-compatible...', value: '__custom__', provider: 'openai' },
        ]
        setOptions(available)
        setDetectError('Claude CLI not found — Claude models unavailable')
        setSubStep('select')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useInput(
    (_, key) => {
      if (subStep !== 'select') return
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (key.downArrow) {
        setSelectedIndex((i) => Math.min(options.length - 1, i + 1))
      } else if (key.return) {
        const opt = options[selectedIndex]
        if (!opt) return
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
            // Already have a key, go to optional URL step
            setSubStep('api-url')
          }
        } else {
          // Claude model — no key needed
          onComplete({ model: opt.value, modelKey: '', modelUrl: undefined })
        }
      }
    },
    { isActive: subStep === 'select' }
  )

  useInput(
    (_, key) => {
      if (!key.escape) return
      if (subStep === 'api-key' || subStep === 'custom-model' || subStep === 'api-url') {
        setSubStep('select')
      }
    },
    { isActive: subStep !== 'detecting' && subStep !== 'select' }
  )

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
    const modelValue = selectedModel?.value === '__custom__'
      ? customModelName
      : selectedModel?.value ?? ''
    onComplete({
      model: modelValue,
      modelKey: apiKey || config.modelKey,
      modelUrl: trimmed || undefined,
    })
  }

  if (subStep === 'detecting') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>AI Model</Text>
        <Text color="yellow">○ Detecting available providers...</Text>
      </Box>
    )
  }

  if (subStep === 'select') {
    return (
      <Box flexDirection="column" gap={1}>
        {detectError && (
          <Box>
            <Text color="yellow">⚠ {detectError}</Text>
          </Box>
        )}
        {claudeAvailable && (
          <Box>
            <Text color="green">✓ Claude CLI detected</Text>
          </Box>
        )}
        <Text dimColor>Use Claude for fastest local setup, or OpenAI-compatible with API key.</Text>
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          {options.map((opt, i) => {
            const isActive = i === selectedIndex
            const isClaudeOption = opt.provider === 'claude'
            const color = isActive ? 'cyan' : isClaudeOption ? undefined : 'yellow'
            return (
              <Box key={opt.value} gap={2}>
                <Text color={color as any} bold={isActive}>
                  {isActive ? '›' : ' '} {opt.label}
                </Text>
                {opt.description && (
                  <Text dimColor>{opt.description}</Text>
                )}
              </Box>
            )
          })}
        </Box>
        <Text dimColor>↑↓ navigate · Enter select · Esc back</Text>
      </Box>
    )
  }

  if (subStep === 'api-key') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          Enter your API key for{' '}
          <Text color="cyan">{selectedModel?.label}</Text>
        </Text>
        {apiKeyError && <Text color="red">✗ {apiKeyError}</Text>}
        {validating ? (
          <Text color="yellow">○ Validating key...</Text>
        ) : (
          <Box borderStyle="single" borderColor="gray" paddingX={1}>
            <Text color="cyan">{'› '}</Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              placeholder="sk-..."
              mask="*"
            />
          </Box>
        )}
        <Text dimColor>Press Enter to confirm</Text>
      </Box>
    )
  }

  if (subStep === 'api-url') {
    const isCustom = selectedModel?.value === '__custom__'
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{isCustom ? 'Custom Endpoint (optional)' : 'API Base URL (optional)'}</Text>
        <Text dimColor>
          {isCustom
            ? 'Enter a base URL for your OpenAI-compatible API, or leave empty to use the default endpoint.'
            : 'Leave empty to use the default OpenAI endpoint.'}
        </Text>
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="cyan">{'› '}</Text>
          <TextInput
            value={apiUrl}
            onChange={setApiUrl}
            onSubmit={handleApiUrlSubmit}
            placeholder='leave empty for default'
          />
        </Box>
        <Text dimColor>Press Enter to continue</Text>
      </Box>
    )
  }

  if (subStep === 'custom-model') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          Enter the model identifier exposed by your provider.
        </Text>
        {customModelError && <Text color="red">✗ {customModelError}</Text>}
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="cyan">{'› '}</Text>
          <TextInput
            value={customModelName}
            onChange={setCustomModelName}
            onSubmit={handleCustomModelSubmit}
            placeholder='gpt-4.1-mini or provider-specific id'
          />
        </Box>
        <Text dimColor>Press Enter to continue</Text>
      </Box>
    )
  }

  return null
}
