import type { ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { GitSettings } from '../../cli/profile.js'
import { GIT_MODE_OPTIONS, detectGitMode, type GitMode } from '../../lib/gitMode.js'
import { FG_DIM, FG_MUTED, SEM_AMBER, SEM_GREEN, SEM_INDIGO } from './tuiTheme.js'

const GIT_FIELD_LABELS: { key: keyof GitSettings; label: string }[] = [
  { key: 'use_worktree', label: 'Worktree' },
  { key: 'branch_create', label: 'Branch' },
  { key: 'commit', label: 'Commit' },
  { key: 'push', label: 'Push' },
  { key: 'pr_create', label: 'PR' }
]

const GIT_MODE_COLORS: Record<GitMode | 'custom', string> = {
  'dry-run': FG_DIM,
  'local-commit': SEM_AMBER,
  'full-pr': SEM_GREEN,
  custom: SEM_INDIGO,
}

const CUSTOM_DISPLAY = { label: 'Custom', desc: 'Mix of individual git toggles' }

function resolveModeDisplay(mode: GitMode | null): { label: string; desc: string; color: string } {
  if (mode === null) return { ...CUSTOM_DISPLAY, color: GIT_MODE_COLORS.custom }
  const opt = GIT_MODE_OPTIONS.find((o) => o.mode === mode)
  return {
    label: opt?.label ?? mode,
    desc: opt?.desc ?? '',
    color: GIT_MODE_COLORS[mode],
  }
}

interface Props {
  git: GitSettings
  title?: string
}

/**
 * Read-only display of git settings as a named mode (Dry run / Local commit / Open PR / Custom),
 * with a short description and — when the mode is "custom" — the 5 raw toggles as a fallback.
 */
export function GitModeSection({ git, title = 'Git operations' }: Props): ReactElement {
  const mode = detectGitMode(git)
  const display = resolveModeDisplay(mode)
  return (
    <box flexDirection='column' gap={0}>
      <text fg={FG_MUTED} attributes={tuiAttrs({ bold: true })}>
        {title}
      </text>
      <box flexDirection='row' gap={1} marginTop={1}>
        <text fg={display.color}>●</text>
        <text fg={display.color}>{display.label}</text>
      </box>
      <text fg={FG_DIM} attributes={tuiAttrs({ dim: true })}>
        {display.desc}
      </text>
      {mode === null && (
        <box flexDirection='column' marginTop={0}>
          {GIT_FIELD_LABELS.map(({ key, label }) => {
            const on = git[key] ?? true
            return (
              <box key={key} flexDirection='row' justifyContent='space-between'>
                <text fg={FG_DIM}>{label}</text>
                <text fg={on ? SEM_GREEN : FG_DIM}>{on ? 'on' : 'off'}</text>
              </box>
            )
          })}
        </box>
      )}
    </box>
  ) as ReactElement
}
