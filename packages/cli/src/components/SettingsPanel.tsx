import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { KeyEvent, MouseEvent } from '@opentui/core'
import { MouseButton, ScrollBoxRenderable } from '@opentui/core'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import type { IAgent } from '../types/index.js'
import type { GitSettings } from '../cli/profile.js'
import {
  Checkbox,
  CheckboxGroup,
  checkboxGroupKeys,
  selectionFromValues,
  selectionToValues,
  toggleCheckboxSelection,
  type CheckboxItem,
  type CheckboxSelection
} from './shared/CheckboxGroup.js'

import {
  ACCENT,
  BG_MODAL,
  BORDER_MUTED,
  FG_ERROR_SOFT,
  FG_HINT,
  FG_TITLE,
  MODAL_BACKDROP_RGBA
} from './shared/tuiTheme.js'
import { FocusedOutlineButton } from './shared/FocusedOutlineButton.js'

const BACKDROP_BG = MODAL_BACKDROP_RGBA

const ADVANCED_SETTINGS_SCROLL_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: true,
    trackOptions: {
      foregroundColor: ACCENT,
      backgroundColor: BORDER_MUTED
    }
  }
} as const

type Focus = { area: 'list'; idx: number } | { area: 'apply' } | { area: 'cancel' }

const AUTO_RESOLVE_KEY = 'auto-resolve'

const GIT_FIELDS: { key: keyof GitSettings; rowKey: string; label: string }[] = [
  { key: 'commit', rowKey: 'git-commit', label: 'Commit changes' },
  { key: 'branch_create', rowKey: 'git-branch_create', label: 'Create branch' },
  { key: 'pr_create', rowKey: 'git-pr_create', label: 'Create pull request' },
  { key: 'push', rowKey: 'git-push', label: 'Push to remote' },
  { key: 'use_worktree', rowKey: 'git-use_worktree', label: 'Use worktree' }
]
const GIT_ROW_KEYS = GIT_FIELDS.map((f) => f.rowKey)

function buildIssueSubscription(
  env: CheckboxSelection,
  comp: CheckboxSelection
): NonNullable<IAgent['settings']>['issueSubscription'] {
  const issueSubscription: NonNullable<IAgent['settings']>['issueSubscription'] = {}
  const envValues = selectionToValues(env)
  const compValues = selectionToValues(comp)
  if (envValues) issueSubscription.environmentName = envValues
  if (compValues) issueSubscription.componentName = compValues
  return issueSubscription
}

export interface SettingsPanelProps {
  /** Pre-filled subscription + agent toggles when we have them (optional). */
  initialSettings?: Partial<IAgent['settings']>
  /** Pre-filled git settings (the booleans persisted in <projectDir>/.multiplayer/settings.json under `git`). */
  initialGitSettings?: GitSettings
  components: string[]
  environments: string[]
  loadError?: string | null
  onApply: (settings: Partial<NonNullable<IAgent['settings']>>) => void
  /** Fires alongside onApply when git toggles change. */
  onApplyGitSettings?: (git: GitSettings) => void
  onClose: () => void
}

export function SettingsPanel({
  initialSettings,
  initialGitSettings,
  components,
  environments,
  loadError,
  onApply,
  onApplyGitSettings,
  onClose
}: SettingsPanelProps): ReactElement {
  const { width, height } = useTerminalDimensions()

  const [envDim, setEnvDim] = useState<CheckboxSelection>({ mode: 'all' })
  const [compDim, setCompDim] = useState<CheckboxSelection>({ mode: 'all' })
  const [autoResolve, setAutoResolve] = useState(false)
  const [gitState, setGitState] = useState<GitSettings>({})
  const [focus, setFocus] = useState<Focus>({ area: 'list', idx: 0 })
  const listScrollRef = useRef<ScrollBoxRenderable | null>(null)

  const modalMaxHeight = Math.max(14, height - 4)

  useEffect(() => {
    const sub = initialSettings?.issueSubscription
    setEnvDim(selectionFromValues(sub?.environmentName, environments))
    setCompDim(selectionFromValues(sub?.componentName, components))
    setAutoResolve(Boolean(initialSettings?.autoResolveIssues))
  }, [initialSettings, environments, components])

  useEffect(() => {
    setGitState(initialGitSettings ?? {})
  }, [initialGitSettings])

  const envItems: CheckboxItem[] = useMemo(
    () => environments.map((name) => ({ value: name, label: name })),
    [environments]
  )
  const compItems: CheckboxItem[] = useMemo(
    () => components.map((name) => ({ value: name, label: name })),
    [components]
  )

  const flatKeys = useMemo<string[]>(
    () => [
      AUTO_RESOLVE_KEY,
      ...GIT_ROW_KEYS,
      ...checkboxGroupKeys('env', envItems),
      ...checkboxGroupKeys('comp', compItems)
    ],
    [envItems, compItems]
  )

  const lastListIdx = Math.max(0, flatKeys.length - 1)
  const focusedKey = focus.area === 'list' ? (flatKeys[focus.idx] ?? null) : null

  useEffect(() => {
    setFocus((f) => (f.area === 'list' && f.idx > lastListIdx ? { area: 'list', idx: lastListIdx } : f))
  }, [lastListIdx])

  useLayoutEffect(() => {
    if (!focusedKey) return
    listScrollRef.current?.scrollChildIntoView(`cb-${focusedKey}`)
  }, [focusedKey])

  const setFocusByKey = useCallback(
    (key: string) => {
      const i = flatKeys.indexOf(key)
      if (i >= 0) setFocus({ area: 'list', idx: i })
    },
    [flatKeys]
  )

  const applyMain = useCallback(() => {
    onApply({
      issueSubscription: buildIssueSubscription(envDim, compDim),
      autoResolveIssues: autoResolve
    })
    onApplyGitSettings?.(gitState)
    onClose()
  }, [envDim, compDim, autoResolve, gitState, onApply, onApplyGitSettings, onClose])

  const activateKey = useCallback(
    (key: string) => {
      if (key === AUTO_RESOLVE_KEY) {
        setAutoResolve((v) => !v)
        return
      }
      const gitField = GIT_FIELDS.find((f) => f.rowKey === key)
      if (gitField) {
        setGitState((g) => ({ ...g, [gitField.key]: !(g[gitField.key] ?? true) }))
        return
      }
      if (key === 'env-all') {
        setEnvDim({ mode: 'all' })
        return
      }
      if (key === 'comp-all') {
        setCompDim({ mode: 'all' })
        return
      }
      if (key.startsWith('env:')) {
        const value = key.slice('env:'.length)
        setEnvDim((d) => toggleCheckboxSelection(d, value, environments))
        return
      }
      if (key.startsWith('comp:')) {
        const value = key.slice('comp:'.length)
        setCompDim((d) => toggleCheckboxSelection(d, value, components))
      }
    },
    [environments, components]
  )

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const { name } = key
        if (name === 'escape') {
          onClose()
          key.stopPropagation()
          return
        }
        if (name === 'up') {
          setFocus((f) => {
            if (f.area === 'cancel') return { area: 'apply' }
            if (f.area === 'apply') return { area: 'list', idx: lastListIdx }
            return { area: 'list', idx: Math.max(0, f.idx - 1) }
          })
          key.stopPropagation()
          return
        }
        if (name === 'down') {
          setFocus((f) => {
            if (f.area === 'list') {
              if (f.idx < lastListIdx) return { area: 'list', idx: f.idx + 1 }
              return { area: 'apply' }
            }
            if (f.area === 'apply') return { area: 'cancel' }
            return f
          })
          key.stopPropagation()
          return
        }
        const sb = listScrollRef.current
        if (sb) {
          if (name === 'pageup') {
            sb.scrollBy(-0.5, 'viewport')
            key.stopPropagation()
            return
          }
          if (name === 'pagedown') {
            sb.scrollBy(0.5, 'viewport')
            key.stopPropagation()
            return
          }
          if (name === 'home') {
            sb.scrollBy(-1, 'content')
            key.stopPropagation()
            return
          }
          if (name === 'end') {
            sb.scrollBy(1, 'content')
            key.stopPropagation()
            return
          }
        }
        if (name === 'return') {
          if (focus.area === 'apply') applyMain()
          else if (focus.area === 'cancel') onClose()
          else if (focusedKey) activateKey(focusedKey)
          key.stopPropagation()
          return
        }
        if (name === 'space') {
          if (focus.area === 'list' && focusedKey) {
            activateKey(focusedKey)
            key.stopPropagation()
          }
        }
      },
      [focus, focusedKey, lastListIdx, activateKey, applyMain, onClose]
    )
  )

  const backdropMouseUp = (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    onClose()
  }

  const stopMouse = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const dialogWidth = Math.min(76, width - 4)
  const maxLabelWidth = dialogWidth - 12

  const renderActionButton = (area: 'apply' | 'cancel', label: string, onActivate: () => void): ReactElement =>
    (
      <FocusedOutlineButton
        label={label}
        focused={focus.area === area}
        onPress={() => {
          setFocus({ area })
          onActivate()
        }}
      />
    ) as ReactElement

  return (
    <box
      position='absolute'
      top={0}
      left={0}
      width={width}
      height={height}
      flexDirection='column'
      justifyContent='center'
      alignItems='center'
      backgroundColor={BACKDROP_BG}
      onMouseUp={backdropMouseUp}
    >
      <box
        flexDirection='column'
        flexShrink={1}
        minHeight={0}
        maxHeight={modalMaxHeight}
        overflow='hidden'
        width={dialogWidth}
        maxWidth={dialogWidth}
        backgroundColor={BG_MODAL}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        gap={0}
        onMouseUp={stopMouse}
      >
        <box flexDirection='column' flexShrink={0} gap={0}>
          <text fg={FG_TITLE} attributes={tuiAttrs({ bold: true })}>
            Settings
          </text>
          {loadError && (
            <text marginTop={1} fg={FG_ERROR_SOFT}>
              {loadError}
            </text>
          )}
        </box>
        <scrollbox
          ref={listScrollRef}
          marginTop={1}
          flexGrow={1}
          minHeight={8}
          flexShrink={1}
          scrollY
          focused={false}
          style={ADVANCED_SETTINGS_SCROLL_STYLE}
        >
          <box flexDirection='column' flexShrink={0} width='100%' gap={0}>
            <text marginTop={1} fg={FG_HINT} attributes={tuiAttrs({ bold: true })}>
              Issues
            </text>
            <Checkbox
              rowKey={AUTO_RESOLVE_KEY}
              label='Auto-resolve issues'
              state={autoResolve ? 'on' : 'off'}
              focused={focusedKey === AUTO_RESOLVE_KEY}
              onActivate={() => setAutoResolve((v) => !v)}
              onFocus={() => setFocusByKey(AUTO_RESOLVE_KEY)}
              maxLabelWidth={maxLabelWidth}
            />

            <text marginTop={1} fg={FG_HINT} attributes={tuiAttrs({ bold: true })}>
              Git operations
            </text>
            {GIT_FIELDS.map((field) => (
              <Checkbox
                key={field.rowKey}
                rowKey={field.rowKey}
                label={field.label}
                state={(gitState[field.key] ?? true) ? 'on' : 'off'}
                focused={focusedKey === field.rowKey}
                onActivate={() => setGitState((g) => ({ ...g, [field.key]: !(g[field.key] ?? true) }))}
                onFocus={() => setFocusByKey(field.rowKey)}
                maxLabelWidth={maxLabelWidth}
              />
            ))}

            <CheckboxGroup
              name='Environments'
              keyPrefix='env'
              items={envItems}
              selection={envDim}
              onChange={setEnvDim}
              focusedKey={focusedKey}
              onFocus={setFocusByKey}
              maxLabelWidth={maxLabelWidth}
              marginTop={1}
            />

            <CheckboxGroup
              name='Components'
              keyPrefix='comp'
              items={compItems}
              selection={compDim}
              onChange={setCompDim}
              focusedKey={focusedKey}
              onFocus={setFocusByKey}
              maxLabelWidth={maxLabelWidth}
              marginTop={1}
            />
          </box>
        </scrollbox>

        <box marginTop={1} flexShrink={0} flexDirection='row' justifyContent='flex-end' gap={2}>
          {renderActionButton('cancel', 'Cancel', onClose)}
          {renderActionButton('apply', 'Apply', applyMain)}
        </box>

        <box marginTop={1} flexShrink={0} flexDirection='row' flexWrap='wrap' gap={0}>
          <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
            ↑↓
          </text>
          <text attributes={tuiAttrs({ dim: true })}> move · </text>
          <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
            PgUp/PgDn
          </text>
          <text attributes={tuiAttrs({ dim: true })}> scroll · </text>
          <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
            Space
          </text>
          <text attributes={tuiAttrs({ dim: true })}> toggle · </text>
          <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
            Enter
          </text>
          <text attributes={tuiAttrs({ dim: true })}> activate · Esc close</text>
        </box>
      </box>
    </box>
  ) as ReactElement
}
