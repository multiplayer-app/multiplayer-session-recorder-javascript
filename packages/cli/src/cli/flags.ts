import type { RuntimeMode } from '../runtime/types.js'
import type { AgentConfig } from '../types/index.js'

export interface ParsedFlags {
  mode: RuntimeMode
  initialConfig: Partial<AgentConfig>
  healthPort?: number
  profileName: string
}

export function isCompleteConfig(cfg: Partial<AgentConfig>): cfg is AgentConfig {
  const needsModelKey = cfg.model ? !cfg.model.startsWith('claude') : true
  return !!(
    cfg.url &&
    cfg.apiKey &&
    cfg.dir &&
    cfg.model &&
    (!needsModelKey || cfg.modelKey)
  )
}
